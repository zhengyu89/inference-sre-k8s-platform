# Kubernetes Setup Progress
1. I setup the frontend,backend,redis,postgres with docker image build. I verified the connection.
2. I start to do the yaml configuration file by opening a k8s folder.
3. I had build the image as the first version in local.
4. I open the k8s with base, components and overlays.
5. I open the required yaml for backend first.
6. I want to host to dockerhub first. because i need to specify the image in backend
7. I encountered an issue, it shows permission denied. But actually it is because for the dockerhub. Each image should be tagged with a username prefix.

docker tag inference-sre-k8s-platform-backend:latest ivantan67/inference-sre-backend:v1
It give local image another tag without rebuild/copy the image data
ivantan67/inference-sre-backend:v1
Nameprefix/reponame/image tag or version

8. k create deployment backend --image=ivantan67/inference-sre-api:v1 --port=3000 --dry-run=client -o yaml > deployment.yaml

add liveness and readiness probe. add resources

9. k create svc clusterip backend --dry-run=client -o yaml > service.yaml

10. Done backend ingress and kustomization, done configmap.

#install argoCD
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm search repo argo/argo-cd
kubectl create namespace argocd

In order to access the server UI you have the following options:

kubectl port-forward service/argocd-server -n argocd 8080:443

    and then open the browser on http://localhost:8080 and accept the certificate

kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

Then logged in and change the password
Set to admin123