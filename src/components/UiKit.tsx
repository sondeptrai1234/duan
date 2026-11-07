import React from "react";
import { Button, Card, Text as TText, XStack, YStack } from "tamagui";

/** Reusable Tamagui UI primitives. The app defines light/dark themes in tamagui.config.ts. */
export function EcoCard({ children, ...props }: any) {
  return <Card elevate bordered backgroundColor="$background" borderColor="$color5" borderRadius="$5" padding="$4" {...props}>{children}</Card>;
}
export function EcoText({ children, strong = false, ...props }: any) {
  return <TText color="$color" fontSize="$4" fontWeight={strong ? "700" : "400"} {...props}>{children}</TText>;
}
export function EcoButton({ children, onPress, ...props }: any) {
  return <Button backgroundColor="$eco" color="white" borderRadius="$4" onPress={onPress} {...props}>{children}</Button>;
}
export function EcoRow({ children, ...props }: any) {
  return <XStack alignItems="center" gap="$3" {...props}>{children}</XStack>;
}
export function EcoColumn({ children, ...props }: any) {
  return <YStack gap="$2" {...props}>{children}</YStack>;
}
