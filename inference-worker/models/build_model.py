#!/usr/bin/env python3
"""Builds models/classifier.onnx from a small hand-written corpus.

Run from inference-worker/ with the dev extras installed:

    python3 -m pip install --user --break-system-packages -r requirements-dev.txt
    python3 models/build_model.py

The task is deliberately trivial (binary text classification, normal vs
suspicious) — the model is not the point of this project, the operability
around it is. See implementation-plan-services.md §5.
"""

import os

import numpy as np
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import StringTensorType
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer

TRAIN_TEXTS = [
    # normal
    "user logged in successfully",
    "payment of $42.00 processed",
    "order shipped to customer address",
    "monthly report generated",
    "password changed by user",
    "profile picture updated",
    "invoice sent to client",
    "user viewed their dashboard",
    "subscription renewed automatically",
    "file uploaded to storage",
    "user updated billing address",
    "weekly newsletter delivered",
    "cart checkout completed",
    "support ticket closed",
    "new device registered for user",
    # suspicious
    "multiple failed login attempts detected",
    "large transfer of $9800 to unknown account",
    "login from unrecognized location and device",
    "password reset requested five times in one minute",
    "unusual number of api requests from single ip",
    "attempt to access admin panel without permission",
    "card used in two countries within one hour",
    "bulk download of customer records",
    "repeated requests with invalid authentication token",
    "transaction flagged for exceeding daily limit",
    "account accessed from known malicious ip range",
    "privilege escalation attempt detected",
    "sql injection pattern found in request payload",
    "brute force attack detected on login endpoint",
    "abnormal spike in failed payment attempts",
]

TRAIN_LABELS = ["normal"] * 15 + ["suspicious"] * 15


def main() -> None:
    # lowercase=False: skl2onnx compiles TfidfVectorizer(lowercase=True) into an
    # ONNX StringNormalizer op that requires an OS locale (e.g. en_US.UTF-8) to
    # be installed — not a safe assumption for a slim container image. Instead,
    # the corpus is already lowercase and the worker lowercases input itself
    # before calling the model (see app/model.py), so no locale-dependent op
    # ever ends up in the graph.
    pipeline = Pipeline(
        [
            ("tfidf", TfidfVectorizer(lowercase=False, ngram_range=(1, 2))),
            ("clf", LogisticRegression(max_iter=1000)),
        ]
    )
    pipeline.fit(TRAIN_TEXTS, TRAIN_LABELS)

    onnx_model = convert_sklearn(
        pipeline,
        initial_types=[("input", StringTensorType([None, 1]))],
        options={id(pipeline.named_steps["clf"]): {"zipmap": False}},
        target_opset=17,
    )

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "classifier.onnx")
    with open(out_path, "wb") as f:
        f.write(onnx_model.SerializeToString())

    print(f"wrote {out_path} ({os.path.getsize(out_path)} bytes)")

    # Quick sanity check with onnxruntime before declaring success.
    import onnxruntime as ort

    session = ort.InferenceSession(out_path, providers=["CPUExecutionProvider"])
    sample = np.array([["multiple failed login attempts detected"]], dtype=object)
    input_name = session.get_inputs()[0].name
    label, proba = session.run(None, {input_name: sample})
    print("sanity check ->", label, proba)


if __name__ == "__main__":
    main()
