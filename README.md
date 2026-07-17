# HC Steno Wala - स्टेनोग्राफी अभ्यास पोर्टल

HC Steno Wala is a modern web application for stenography students to practice typing, take audio dictation tests, and analyze their performance.

## 🌟 Features
- Secure Authentication via Firebase (Mobile/Email format)
- Full Admin Panel to manage Tests and Users
- Premium Tests support
- Audio Dictation player built-in
- Real-time WPM and Word Count calculation
- Text Comparison algorithm for checking mistakes
- Responsive modern dark-theme design
- Glassmorphism UI elements

## 🚀 Setup Guide / सेटअप गाइड

### Step 1: Firebase Setup
1. Go to [firebase.google.com](https://firebase.google.com) and create a new project named `hc-steno-wala`.
2. In the sidebar, go to **Build > Authentication** and enable the **Email/Password** sign-in method.
3. Go to **Build > Firestore Database** and click "Create Database". Start in test mode and select `asia-south1` (Mumbai) region.
4. Go to **Build > Storage** and get started.
5. Go to **Project Settings** (gear icon) > General. Under "Your apps", click the **Web (</>)** icon to register a new app.
6. Copy the Firebase configuration object provided.
7. Open `js/firebase-config.js` in your code and replace the placeholder values with your actual config keys.

### Step 2: Set First Admin User
1. Open the website locally or after deployment and register a new account.
2. Go back to the Firebase Console -> Firestore Database.
3. Find the `users` collection and locate the document that corresponds to your newly created user.
4. Change the `role` field value from `"student"` to `"admin"`.
5. Refresh the website. You will now have access to the Admin Panel.

### Step 3: GitHub Pages Deployment
1. Create a free account on [GitHub](https://github.com) if you don't have one.
2. Create a new repository named `hc-steno-wala`.
3. Open a terminal in your project folder and run:
   ```bash
   git init
   git add .
   git commit -m 'HC Steno Wala - Initial Release'
   git branch -M main
   git remote add origin https://github.com/USERNAME/hc-steno-wala.git
   git push -u origin main
   ```
4. On GitHub, go to your repository **Settings > Pages**.
5. Under "Source", select **Deploy from a branch**. Under "Branch", select `main` and `/ (root)`.
6. Click Save. Wait 2-3 minutes.
7. Your site will be live at: `https://USERNAME.github.io/hc-steno-wala/`

### Step 4: Firebase Security Rules
To secure your database in production, go to Firestore Rules and set:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /tests/{testId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /results/{resultId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
    match /contacts/{contactId} {
      allow create: if true;
      allow read, write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## 📞 Contact
- Mobile: 9799867629
- Email: highcourtsteno2024@gmail.com
- Location: Jodhpur, Rajasthan
