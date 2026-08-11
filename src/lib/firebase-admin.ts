import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'

let _app: App | undefined
let _auth: Auth | undefined

function getAdminApp(): App {
  if (_app) return _app
  const apps = getApps()
  _app = apps.length === 0
    ? initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      })
    : apps[0]
  return _app
}

export function getAdminAuth(): Auth {
  if (_auth) return _auth
  _auth = getAuth(getAdminApp())
  return _auth
}
