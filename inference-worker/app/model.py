"""ONNX session wrapper: load once, predict many times.

Loaded in the FastAPI lifespan handler (see main.py) and held as module
state. `is_loaded()` only becomes true after a successful warm-up inference —
that is what GET /health/ready reports.
"""

import numpy as np
import onnxruntime as ort

from . import config


class Classifier:
    def __init__(self) -> None:
        self._session: ort.InferenceSession | None = None
        self._input_name: str | None = None
        self._loaded = False

    def load(self) -> None:
        session = ort.InferenceSession(config.MODEL_PATH, providers=["CPUExecutionProvider"])
        input_name = session.get_inputs()[0].name

        # Warm-up inference — catches a broken/incompatible model file at
        # startup instead of on the first real request, and is what flips
        # model_loaded to true.
        session.run(None, {input_name: np.array([["warmup"]], dtype=object)})

        self._session = session
        self._input_name = input_name
        self._loaded = True

    def is_loaded(self) -> bool:
        return self._loaded

    def predict(self, text: str) -> tuple[str, float]:
        """Returns (prediction_label, confidence)."""
        if not self._loaded or self._session is None or self._input_name is None:
            raise RuntimeError("model not loaded")

        # Lowercase here, in Python, rather than baking a locale-dependent
        # ONNX StringNormalizer op into the graph — see models/build_model.py.
        sample = np.array([[text.lower()]], dtype=object)
        labels, probabilities = self._session.run(None, {self._input_name: sample})

        label = str(labels[0])
        confidence = float(np.max(probabilities[0]))
        return label, confidence


classifier = Classifier()
