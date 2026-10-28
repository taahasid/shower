# Did They Shower?

A daily shower tracker for Aamina and Hafsa. Each day gets a yes or no vote, and a vote only counts when the right person signs it: **Sarmad** signs for Aamina, **Taaha** signs for Hafsa. A calendar shows the whole month, with totals and a streak for each person.

It's a plain static site (HTML, CSS, JS), so it runs on GitHub Pages without a build step.

## Run it locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

Without a Firebase config the site runs in **local mode**: votes save only in that browser.

## Share votes between everyone (Firebase)

GitHub Pages can't store data, so shared votes live in a free Firebase Firestore database.

1. Go to <https://console.firebase.google.com>, create a project.
2. **Build → Firestore Database → Create database** (production mode, any region).
3. In the **Rules** tab, paste the contents of `firestore.rules` and publish.
4. **Project settings → General → Your apps → Web (`</>`)**, register an app, and copy the `firebaseConfig` object.
5. Paste it into `firebase-config.js`:

   ```js
   window.FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", /* ... */ };
   ```

The Firebase web config is meant to be public, so committing it is fine. The rules in `firestore.rules` only accept votes signed by the correct person.

## Publish on GitHub Pages

```sh
git remote add origin https://github.com/<your-username>/shower-tracker.git
git push -u origin main
```

Then in the repo on GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / root**. The site appears at `https://<your-username>.github.io/shower-tracker/`.

## Note on signatures

The signature is a typed name, so it works on the honor system. Anyone who knows to type "Sarmad" or "Taaha" can sign.
