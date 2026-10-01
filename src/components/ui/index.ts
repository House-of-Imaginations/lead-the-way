// Design-system components. Client components import from "@/components/ui".
// Server Components import the leaf ("@/components/ui/Button") so a server
// route doesn't pull every client component into its bundle (P3 Ruling 1).
export { Logo } from "./Logo";
export { Tag, type TagProps } from "./Tag";
export { Avatar, type AvatarProps } from "./Avatar";
export {
  InlineNotification,
  type InlineNotificationProps,
} from "./InlineNotification";
export { StatTile, type StatTileProps } from "./StatTile";
export { Skeleton } from "./Skeleton";

export {
  Button,
  ButtonLink,
  buttonClass,
  type ButtonKind,
  type ButtonLinkProps,
  type ButtonProps,
  type ButtonSize,
} from "./Button";

export type { Option } from "./types";
export type { FieldProps } from "./Field";
export {
  TextArea,
  TextInput,
  type TextAreaProps,
  type TextInputProps,
} from "./TextInput";
export { PasswordInput, type PasswordInputProps } from "./PasswordInput";
export { Select, type SelectProps } from "./Select";
export { Checkbox, type CheckboxProps } from "./Checkbox";
export { Toggle, type ToggleProps } from "./Toggle";
export { ContentSwitcher, type ContentSwitcherProps } from "./ContentSwitcher";
export { SelectableTile, type SelectableTileProps } from "./SelectableTile";
export {
  SelectableTileGroup,
  type SelectableTileGroupProps,
} from "./SelectableTileGroup";
export { LikertScale, type LikertScaleProps } from "./LikertScale";
export { Tabs, type TabItem, type TabsProps } from "./Tabs";
export { Disclosure, type DisclosureProps } from "./Disclosure";
export { ProgressBar, type ProgressBarProps } from "./ProgressBar";
export {
  ProgressSteps,
  type ProgressStepsProps,
  type Step,
} from "./ProgressSteps";
export { ToastProvider, useToast, type ToastInput } from "./Toast";
export { Modal, type ModalProps } from "./Modal";
export { Menu, type MenuItem, type MenuProps } from "./Menu";
export { VideoPlayer, type VideoPlayerProps } from "./VideoPlayer";
export {
  SideNav,
  type SideNavChecklist,
  type SideNavLink,
  type SideNavProps,
  type SideNavSection,
  type SideNavStatus,
} from "./SideNav";
export { DemoBanner } from "./DemoBanner";
export { TopBar, type TopBarProps } from "./TopBar";
