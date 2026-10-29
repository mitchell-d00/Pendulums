# Contributing

Thanks for helping improve Pendulums. Start with the [README](README.md) and [development guide](docs/DEVELOPMENT.md).

## Make a change

1. Create a branch from current `main` and keep the change focused.
2. Preserve the plain HTML/CSS/JavaScript, offline runtime unless a dependency change is part of the proposal.
3. Use the existing solver for physical motion. Visual paths must come from measured positions; keep camera and artwork operations separate from forces.
4. Preserve individual override precedence, unrelated bobs' state during single-bob edits, and compatibility with supported version-one JSON files.
5. Update the relevant guides and in-app explanations when behavior changes. Document file-format limits and distinctions between configuration, live state, and frozen art.

## Verify and submit

Run the complete Node command in [development and testing](docs/DEVELOPMENT.md#testing). For physics/UI behavior changes, run the relevant Python browser suites with their prerequisites installed, including override and mirrored-action regressions when editing those workflows. Check phone and desktop layouts for interface changes. For documentation-only edits, verify commands, file references, and claims against the implementation.

In a pull request, describe the concrete behavior changed, why, and which checks passed. State unavailable checks explicitly. Do not present injected-source tests as deployed-site verification or reuse an old pass count as a current result. Avoid generated test downloads, virtual environments, and unrelated screenshot changes in commits.

## Report a problem

Use [GitHub Issues](https://github.com/mitchell-d00/Pendulums/issues) and include reproduction steps, expected/actual behavior, browser and operating system, viewport/device, and whether you opened a local file, used local HTTP, or visited a deployed site. For physics issues, include preset/count, gravity, damping, relevant individual overrides, and a minimal exported session if possible. For artwork issues, distinguish physics-session JSON from layered-art JSON.

Contributions are distributed under the repository's [MIT license](LICENSE).
