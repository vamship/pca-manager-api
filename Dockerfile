FROM node:8.14.0-alpine

ARG APP_NAME
ARG BUILD_TIMESTAMP
ARG APP_VERSION

# Metadata
LABEL org.label-schema.name=$APP_NAME \
      org.label-schema.version=$APP_VERSION \
      org.label-schema.build-date=$BUILD_TIMESTAMP \
      org.label-schema.url="https://hub.docker.com/r/vamship/pca-manager-microservice/" \
      org.label-schema.vcs-url="https://github.com/vamship/pca-manager-microservice"

# Note: Latest version of kubectl may be found at:
# https://aur.archlinux.org/packages/kubectl-bin/
ENV KUBE_LATEST_VERSION="v1.12.0"

# Note: Latest version of helm may be found at:
# https://github.com/kubernetes/helm/releases
ENV HELM_VERSION="v2.11.0"

RUN apk update \
    && apk add --no-cache ca-certificates \
    && wget -q https://storage.googleapis.com/kubernetes-release/release/${KUBE_LATEST_VERSION}/bin/linux/amd64/kubectl \
       -O /usr/local/bin/kubectl \
    && chmod +x /usr/local/bin/kubectl \
    && wget -q https://storage.googleapis.com/kubernetes-helm/helm-${HELM_VERSION}-linux-amd64.tar.gz \
       -O - | tar -xzO linux-amd64/helm > /usr/local/bin/helm \
    && chmod +x /usr/local/bin/helm \
    && mkdir -p /root/.helm \
    && helm init --client-only \
    && helm repo update

RUN mkdir -p app/logs

COPY ./dist app/dist
COPY ./.${APP_NAME}rc app/.${APP_NAME}rc
COPY ./package.json app/package.json
COPY ./package-lock.json app/package-lock.json

WORKDIR app

ENV NODE_ENV=production
RUN ["npm", "install"]
CMD ["npm", "start"]
