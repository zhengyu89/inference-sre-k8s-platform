# INC-001 — <Incident Title>

**Date:** YYYY-MM-DD  
**Component:** <Cilium / Istio / CoreDNS / Argo CD / Gateway API / etc.>  
**Status:** ✅ Resolved

---

## 1. Problem

Briefly describe what went wrong.

> Example: Pods in the `frontend` namespace could no longer communicate with the backend service after applying a new CiliumNetworkPolicy.

**Expected behaviour:**  
<What should have happened?>

**Actual behaviour:**  
<What happened instead?>

---

## 2. Impact

Describe what broke and the scope of the problem.

- **Affected:** <Pods / Service / Namespace / Node>
- **Symptoms:** <Timeout / 503 / connection refused / Pending / CrashLoopBackOff>
- **Scope:** <Single workload / namespace / cluster-wide>

---

## 3. Investigation

Document the important troubleshooting steps and what each one told you.

```bash
kubectl get pods -A
kubectl describe pod <pod>
kubectl get events
```

**Observation:**  
<What did you discover?>

Then continue with the commands that helped narrow down the problem:

```bash
<command>

# Important output
<output>
```

**Finding:**  
<Why did this point you toward the root cause?>

### Root Cause

> <Explain the actual technical reason the incident happened.>

---

## 4. Solution

Explain how you fixed the problem.

```bash
<commands used>
```

Or show the important configuration change:

```yaml
<fixed configuration>
```

### Verification

```bash
<commands used to verify the fix>
```

**Result:**  
✅ <Describe how you confirmed the system was working again.>

---

## 5. What I Learned

### Technical

- <Kubernetes concept learned>
- <Networking / security / scheduling behaviour learned>
- <Useful command or debugging technique learned>

### Troubleshooting

> <What would you check first if this happened again?>

### Prevention

> <What could be changed so this problem is detected earlier or does not happen again?>

### Key Takeaway

> **<One sentence summarizing the most important lesson from this incident.>**