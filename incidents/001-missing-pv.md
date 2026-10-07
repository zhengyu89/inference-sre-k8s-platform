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

```bash
git fetch
git pull origin main
k apply -f k8s/argocd/application-storage.yaml 
```

### Verification

```bash
k -n inference-sre-platform get po -w
# postgres-0 is running
# can see from argoCD UI as well. All the pod is green and the application is in healthy now.
k get ns
# NAME                     STATUS   AGE
# local-path-storage       Active   9m27s
k -n local-path-storage get all
# NAME                                          READY   STATUS    RESTARTS   AGE
# pod/local-path-provisioner-7c7ff4f446-8xvwx   1/1     Running   0          10m

# NAME                                     READY   UP-TO-DATE   AVAILABLE   AGE
# deployment.apps/local-path-provisioner   1/1     1            1           10m

# NAME                                                DESIRED   CURRENT   READY   AGE
# replicaset.apps/local-path-provisioner-7c7ff4f446   1         1         1       10m

k -n local-path-storage get cm
# NAME                DATA   AGE
# kube-root-ca.crt    1      10m
# local-path-config   4      10m
```

**Result:**  
```bash
k -n inference-sre-platform get po postgres-0 -o yaml
# postgres-0 is running
k get pvc -n inference-sre-platform 
# NAME                       STATUS   VOLUME                                     CAPACITY    
# ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
# postgres-data-postgres-0   Bound    pvc-bccee8d6-7141-4378-95d9-eb7444ba9174   1Gi        
# RWO            standard       <unset>                 3h23
k get pv -n inference-sre-platform
# NAME                                       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM                                                                                                               STORAGECLASS   VOLUMEATTRIBUTESCLASS   REASON   AGE
# pvc-38786c03-36e5-434d-8ea4-f19225041040   5Gi        RWO            Delete           Bound    monitoring/prometheus-monitoring-kube-prometheus-prometheus-db-prometheus-monitoring-kube-prometheus-prometheus-0   standard       <unset>                          6m49s
# pvc-bccee8d6-7141-4378-95d9-eb7444ba9174   1Gi        RWO            Delete           Bound    inference-sre-platform/postgres-data-postgres-0   
```

Based on the observation. The PVC had successfully bounded with the PV assigned by rancher local path provisioner. 2 PV had created by storageClass [another one is for prometheus]. Postgres statefulset works properly.

---

## 5. What I Learned

### Technical

- Learned how to setup and manage persistent storage for an on-prem Kubernetes cluster
  using **Rancher Local Path Provisioner and StorageClass**. Althrough that for prototype lab purpose,
  a manually created persistance volume with empty dir can do the job. But here we are demonstrating the best practise.
- Understand how PVCs are dynamically bound to PVs.
- Practised troubleshooting storage issues and inspecting local-path provisioner.

<u>Knowledge on rancher/local-path-provisioner</u>

- When we install the provision from kubectl/kustomize:
```bash
kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.37/deploy/local-path-storage.yaml
kustomize build "github.com/rancher/local-path-provisioner/deploy?ref=v0.0.37" | kubectl apply -f -
```
A namespace called local-path-storage will be created along with:
```
Namespace
ServiceAccount
Role
RoleBinding
ClusterRole
ClusterRoleBinding
Deployment
ConfigMap
StorageClass
```

### Troubleshooting

> <What would you check first if this happened again?>
I will directly check the PVC status by k get pvc -n <ns name>

### Prevention

> <What could be changed so this problem is detected earlier or does not happen again?>
Ensure that when the cluster is kubeadm, a storage application should be created for storageClass.

### Key Takeaway

> **<One sentence summarizing the most important lesson from this incident.>**
A PVC cannot dynamically create storage by itself. the cluster must first have a working StorageClass 
and provisioner to create and bind a PersistentVolume.

## 6. Reference
https://kubernetes.io/docs/concepts/storage/storage-classes/
https://github.com/kubernetes-sigs/kind/issues/2243
https://github.com/rancher/local-path-provisioner