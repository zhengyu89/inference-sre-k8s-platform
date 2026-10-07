# INC-001 — Missing Persistence Volume

**Date:** 7/10/2026 
**Component:** Postgres statefulset 
**Status:** ✅ Resolved

---

## 1. Problem

Briefly describe what went wrong.

> Pod in 'postgres' sts cannot run properly. pod 'postgres-0' in the pending status. When inpecting in ArgoCD, the reason shows FailedScheduling: 0/3 nodes are available: pod has unbound immediate PersistentVolumeClaims. not found.

**Expected behaviour:**  
It should be matching with assigned PVC and run properly.

**Actual behaviour:**  
The pod fail to start.

---

## 2. Impact

Describe what broke and the scope of the problem.

- **Affected:** Pod
- **Symptoms:** Pending
- **Scope:** cluster-wide

---

## 3. Investigation

Document the important troubleshooting steps and what each one told you.

```bash
1. Read through ArgoCD on broken pod
2. Use k command to troubleshoot problems in order to train command skills
k get ns
# NAME                     STATUS   AGE
# inference-sre-platform   Active   25m
k -n inference-sre-platform get po
# NAME         READY   STATUS    RESTARTS   AGE
# postgres-0   0/1     Pending   0          26m
k -n inference-sre-platform get po postgres-0 -o yaml
# message: '0/3 nodes are available: pod has unbound immediate 
# PersistentVolumeClaims.   not found'
```

**Observation:**  
1. The postgres pod have unfufilled pvc, let's narrow down to pvc:
```bash
k -n inference-sre-platform get pvc
# NAME                       STATUS    VOLUMEATTRIBUTESCLASS   AGE
# postgres-data-postgres-0   Pending   <unset>                 34m
k -n inference-sre-platform get pvc postgres-data-postgres-0 -o yaml
# Show nothing infomative
k -n inference-sre-platform describe pvc postgres-data-postgres-0
#Events:
# Type    Reason         Age                    From                         Message
# ----    ------         ----                   ----                         -------
# Normal  FailedBinding  3m24s (x142 over 38m)  persistentvolume-controller  no 
# persistent volumes available for this claim and no storage class is set
k get pv -A
k get storageclass -A
# Both No resources found
```


**Finding:**  
There is no default storageClass in this cluster. No pv is created. Hence, pvc does not bounding with any pv.

### Root Cause
This is a kubeadm cluster. Unlike kind, it does not have a default storageClass to auto assign a PV, causing postgres unable to start.

---

## 4. Solution

1. I need to find a provisioner for storageClass.
2. In this case, rancher/local-path-provisioner is chosen. It is because it is suitable for on-prem setup and is the default provisioner for Kind's storageClass.
3. storage/storageclass.yaml is configured
4. Create a application for storageClass. 

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

## 6. Reference
https://kubernetes.io/docs/concepts/storage/storage-classes/
https://github.com/kubernetes-sigs/kind/issues/2243
https://github.com/rancher/local-path-provisioner