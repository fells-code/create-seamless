---
'seamless-cli': patch
---

Follow the React SDK's passkey enrollment through the removal of its naming step.

`@seamless-auth/react` used to open a "Name This Device" modal after "Register Passkey" was
pressed, and the harness typed into it before the WebAuthn ceremony would start. That view is
gone from the SDK, so `registerWithPasskey` waited 30 seconds for a placeholder that no longer
renders and then timed out, failing `react/passkeyRegister.spec.ts` and `react/passkeyLogin.spec.ts`
(which registers before it signs back in).

The helper now stops at the button, which is where the ceremony begins. This tracks the SDK
release that drops the modal, so a `--local` run against an older React checkout, or a published
run before that release lands on npm, will fail on the modal this no longer dismisses.
