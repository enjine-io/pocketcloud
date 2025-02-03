FROM node:18-alpine
ARG BUILDARCH
ARG PB_VERSION=0.22.9
WORKDIR /app
COPY . /app
RUN npm install && npm install express pm2@latest -g
RUN npm install --prefix /app/pm2-webui
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${BUILDARCH}.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /tmp/db/
RUN rm /tmp/pb.zip
RUN mkdir /app/data
ENV NODE_PATH=/usr/local/lib/node_modules
CMD ["/bin/sh", "-c", "\
    cp -r /tmp/db /app/data/; \
    [ ! -d /app/data/files/apps ] && mkdir -p /app/data/files/apps && cp -r /app/files/apps/* /app/data/files/apps || echo 'apps folder already exists, skipping copy.'; \
    [ ! -d /app/data/files/public ] && cp -r /app/files/public /app/data/files || echo 'public folder already exists, skipping copy.'; \
    [ ! -f /app/data/files/routes.json ] && cp -r /app/files/routes.json /app/data/files/routes.json || echo 'routes.json already exists, skipping copy.'; \
    rm -rf /app/files; \
    /app/data/db/pocketbase admin create ${PB_ADMIN_EMAIL} ${ADMIN_KEY} & \
    /app/data/db/pocketbase admin update ${PB_ADMIN_EMAIL} ${ADMIN_KEY} & \
    /app/data/db/pocketbase serve --http=0.0.0.0:8686 & \
    node /app/file-manager/file-server.js & \
    pm2 start /app/proxy/proxy.js --name proxy && \
    node /app/pm2/run-apps.js & \
    node /app/pm2-webui/src/app.js & \
    node /app/admin/index.js"]
