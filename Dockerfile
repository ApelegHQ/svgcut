# Copyright © 2021 Exact Realty Limited
#
# All rights reserved
#
# THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
# REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
# AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
# INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
# LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
# OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
# PERFORMANCE OF THIS SOFTWARE.

FROM node:lts-alpine3.14 AS builder-stage1

RUN adduser -S -g "" -h "/home/build" "build" \
 && apk add --update --no-cache "python3" "make" "pixman-dev" "pango-dev" "giflib-dev" "alpine-sdk"

COPY --chown=0.0 . /home/build/app

WORKDIR /home/build/app

RUN install -o build -m 700 -d node_modules \
 && install -o build -m 700 -d dist

USER build

ENV CI=true

ARG NODE_ENV=production

RUN make ci-build

FROM node:lts-alpine3.14 AS builder-stage2

RUN adduser -S -g "" -h "/home/build" "build" \
 && apk add --update --no-cache "python3" "make"

RUN install -d -o build /home/build/app/dist

USER build

RUN echo "prefix = $HOME/node-prefix" > $HOME/.npmrc \
 && npm install -g pkg

# Layer caching
RUN export NODE_MAJOR="$(node -e 'process.stdout.write(String(+process.versions.node.split(".")[0]))')" \
 && mkdir /tmp/dummy \
 && cd /tmp/dummy \
 && touch dummy.js \
 && $HOME/node-prefix/bin/pkg -t "$(sep=""; for platform in alpine linux win macos; do for arch in x64 arm64; do printf "${sep}node${NODE_MAJOR}-${platform}-${arch}"; sep=","; done; done)" "dummy.js" \
 && rm -rf /tmp/dummy

COPY --from=builder-stage1 --chown=0.0 --chmod=444 /home/build/app/dist/app.js /home/build/app/dist/app.js

WORKDIR /home/build/app/dist

RUN export NODE_MAJOR="$(node -e 'process.stdout.write(String(+process.versions.node.split(".")[0]))')" \
 && $HOME/node-prefix/bin/pkg -t "$(sep=""; for platform in alpine linux win macos; do for arch in x64 arm64; do printf "${sep}node${NODE_MAJOR}-${platform}-${arch}"; sep=","; done; done)" "app.js"

RUN ls

