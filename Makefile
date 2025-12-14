install:
	npm ci

publish:
	npm publish --dry-run

lint:
	npx eslint .

lintfix:
	npx eslint --fix .

test:
	npm test
