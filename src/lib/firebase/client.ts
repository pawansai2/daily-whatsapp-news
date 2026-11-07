"use client";

import {
  getApps,
  initializeApp,
} from "firebase/app";
import {
  getAuth,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";

import { getFirebaseWebConfig } from "./config";

const APP_NAME = "daily-whatsapp-news";

export function getFirebaseClientApp() {
  const existing = getApps().find((app) => app.name === APP_NAME);
  return existing ?? initializeApp(getFirebaseWebConfig(), APP_NAME);
}

export function getFirebaseClientAuth(): Auth {
  return getAuth(getFirebaseClientApp());
}

export function getFirebaseClientFirestore(): Firestore {
  return getFirestore(getFirebaseClientApp());
}
