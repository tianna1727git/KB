# Stage login robot

The shared login gateway renders a sparse pencil-outline robot based on the supplied speech-bubble sketch, key-holding and open-head references. Primary contours carry more weight than interior marks; slight breaks and secondary strokes preserve pencil character without dense shading. `lib/studio/login-robot.mjs` embeds a transparent three-pose PNG (front, back, open head); `login-font.mjs` embeds the existing handwriting font. Neither asset requires an external request.

The idle CSS loop opens the head and moves a separate SVG key into the mouth. Password hover, focus, or a nonempty field overrides the loop and shows the back pose. CSS checks field state only; no script reads or logs credentials. Reduced-motion preferences disable movement while preserving the privacy pose. The existing native POST login and authentication checks remain in place.

Validation: password-auth unit and Workers/D1 integration tests, gateway tests, and a Chromium flow covering asset loading under CSP, hover/focus/filled privacy states, the eating pose, reduced motion, mobile overflow and native form submission.

Deployment must restart the shared Stage gateway, as well as the Payo worker. The pinned Stage deployment script invokes the gateway configuration script for this purpose. The login is shared by Stage workspaces; production and PMI source/data are not updated.
