.PHONY: install build ui bin test verify release

install: ## install dependencies
	bun install

build: ## compile TypeScript to dist/
	npm run build

ui: ## build the admin SPA and embed it
	npm run build:ui && npm run embed:ui

bin: ## compile the single binary for this machine
	npm run build:bin

test: ## unit + contract tests
	npm test

verify: ## every gate, as CI runs them
	npm run verify

release: ## npm run release -- patch --push
	npm run release -- $(or $(VERSION),patch) --push
