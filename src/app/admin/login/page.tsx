"use client";
import { useActionState } from "react";
import { loginAction } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="section-title text-center text-3xl">Admin sign in</h1>
      <form action={action} className="card mt-6 space-y-4 p-6">
        <label className="block text-sm font-medium">Email
          <input name="email" type="email" required autoComplete="username" className="field mt-1" />
        </label>
        <label className="block text-sm font-medium">Password
          <input name="password" type="password" required autoComplete="current-password" className="field mt-1" />
        </label>
        {state?.error && <p role="alert" className="text-sm text-alert">{state.error}</p>}
        <button disabled={pending} className="btn-brand w-full disabled:opacity-60">{pending ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
