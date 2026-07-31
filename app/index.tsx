import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth-context";

export default function Index() {
  const { profile } = useAuth();
  return <Redirect href={profile ? "/(resident)/home" : "/(auth)/login"} />;
}
