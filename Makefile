# Copyright © 2021 Exact Realty Limited
#
# All rights reserved.
#
# THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
# REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
# AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
# INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
# LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
# OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
# PERFORMANCE OF THIS SOFTWARE.

DOCKER_REGISTRY := $(or $(SVGCUT_DOCKER_REGISTRY),$(DOCKER_REGISTRY))
DOCKER_BASE_IMAGE := $(or $(SVGCUT_DOCKER_BASE_IMAGE),$(DOCKER_BASE_IMAGE),svgcut)
DOCKER_TAG := $(or $(SVGCUT_DOCKER_TAG),$(DOCKER_TAG),latest)
DOCKER_IMAGE := $(if $(strip $(DOCKER_REGISTRY)),$(strip $(DOCKER_REGISTRY))/$(DOCKER_BASE_IMAGE):$(DOCKER_TAG),$(DOCKER_BASE_IMAGE):$(DOCKER_TAG))

NODE_ENV := $(or $(SVGCUT_NODE_ENV),$(NODE_ENV))

DOCKER ?= docker
NPM ?= npm

all: ci

clean:
	$(RM) -r dist

ci: export NODE_ENV = test
ci: package.json package-lock.json
	$(NPM) ci
	$(NPM) run lint
	# $(NPM) run test

ci-build: export NODE_ENV := $(NODE_ENV)
ci-build: ci Gruntfile.js
	$(NPM) run build

docker: Dockerfile
	$(DOCKER) build --build-arg NODE_ENV=$(NODE_ENV) -t $(DOCKER_IMAGE) .

docker-push: docker
	$(DOCKER) push $(DOCKER_IMAGE)

deploy: docker-push

.PHONY: all clean ci ci-build docker docker-push deploy
