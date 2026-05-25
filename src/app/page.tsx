import { redirect } from "next/navigation";

// Root redirects to the dashboard; the proxy handles unauthenticated visitors.
export default function Home() {
  redirect("/dashboard");
}
