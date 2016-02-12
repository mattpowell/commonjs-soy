help:
	@echo "make prepublish|clean|build"

prepublish: clean build

clean:
	rm -rf java/build/*

build:
	cd java/build/ && \
	javac -d . -cp ../../node_modules/closure-templates/SoyToJsSrcCompiler.jar ../src/*.java && \
	jar xf ../../node_modules/closure-templates/SoyToJsSrcCompiler.jar && \
	jar cf ExtendedSoyToJsSrcCompiler.jar * && \
	find * ! -name "ExtendedSoyToJsSrcCompiler.jar" -delete

.PHONY: help