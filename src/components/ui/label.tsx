"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { useLocalizedChildren } from "@/hooks/use-localized-children";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const CONTROL_SELECTOR =
  "input:not([type=hidden]),textarea,select,[role=combobox],[role=switch],[role=checkbox],[role=radiogroup]";

/**
 * Associates a label with its sibling form control when no htmlFor was set.
 * Keeps click-to-focus and screen-reader/automation label lookup working
 * across every form in the app without touching each call site.
 */
function useAutoAssociate(
  explicitFor: string | undefined,
  generatedId: string,
): React.RefObject<HTMLLabelElement | null> {
  const nodeRef = React.useRef<HTMLLabelElement | null>(null);

  React.useEffect(() => {
    if (explicitFor) return;
    const label = nodeRef.current;
    const scope = label?.parentElement;
    if (!label || !scope) return;

    const control = scope.querySelector<HTMLElement>(CONTROL_SELECTOR);
    if (!control) return;

    if (!control.id) control.id = generatedId;
    label.setAttribute("for", control.id);
  });

  return nodeRef;
}

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, children, htmlFor, ...props }, ref) => {
  const generatedId = React.useId().replace(/:/g, "");
  const autoRef = useAutoAssociate(htmlFor, `field-${generatedId}`);
  const localized = useLocalizedChildren(children);

  return (
    <LabelPrimitive.Root
      ref={(node) => {
        autoRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLLabelElement | null>).current = node;
      }}
      htmlFor={htmlFor}
      className={cn(labelVariants(), className)}
      {...props}
    >
      {localized}
    </LabelPrimitive.Root>
  );
});
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
