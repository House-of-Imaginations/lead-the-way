// Lead the Way components. window.LeadTheWay. React 18, no JSX needed.
type IconName = 'checkmark--filled' | 'checkmark' | 'information' | 'close' | 'chevron--down' | 'chevron--left' | 'chevron--sort' | 'dashboard' | 'document--tasks' | 'education' | 'calendar' | 'settings' | 'arrow--right' | 'add' | 'time' | 'catalog' | 'certificate' | 'chart--column' | 'portfolio' | 'help' | 'logout' | 'warning--filled' | 'locked' | 'view--off' | 'enterprise' | 'edit' | 'send' | 'download';

export interface IconProps { name: IconName; size?: 12 | 16 | 20 | 24 | 32; label?: string; className?: string }
export interface ButtonProps { kind?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg' | 'xl'; icon?: IconName; href?: string; type?: 'button' | 'submit'; disabled?: boolean; onClick?: (e: any) => void; children: React.ReactNode }
export interface TagProps { color?: 'gray' | 'blue' | 'green'; icon?: IconName; onDismiss?: () => void; children: string }
export interface FieldProps { id: string; label?: string; helper?: string; invalid?: boolean; error?: string; disabled?: boolean }
export interface TextInputProps extends FieldProps { value?: string; defaultValue?: string; placeholder?: string; onChange?: (e: any) => void }
export interface TextAreaProps extends TextInputProps { rows?: number }
export interface SelectProps extends FieldProps { options: (string | { value: string; label: string })[]; value?: string; defaultValue?: string; onChange?: (e: any) => void }
export interface CheckboxProps { label: React.ReactNode; helper?: string; checked?: boolean; defaultChecked?: boolean; disabled?: boolean; onChange?: (e: any) => void }
export interface ToggleProps { label?: string; description?: string; on?: boolean; defaultOn?: boolean; onChange?: (on: boolean) => void }
export interface TabsProps { tabs: string[]; index?: number; defaultIndex?: number; onChange?: (i: number) => void }
export interface ContentSwitcherProps { options: string[]; label?: string; index?: number; defaultIndex?: number; onChange?: (i: number) => void }
export interface SelectableTileProps { title: string; description?: string; icon?: IconName; selected?: boolean; defaultSelected?: boolean; onChange?: (on: boolean) => void }
export interface InlineNotificationProps { kind?: 'info' | 'success'; title?: string; icon?: IconName; children: React.ReactNode }
export interface ToastProps { title: string; children?: React.ReactNode; onClose?: () => void }
export interface ProgressBarProps { label?: string; value: number; max?: number; valueText?: string; helper?: string }
export interface ProgressStepsProps { steps: string[]; current: number }
export interface StatTileProps { label: string; value: string; helper?: string }
export interface SideNavItem { label: string; icon: IconName; href?: string; current?: boolean }
export interface SideNavProps { sections: { title: string; items: SideNavItem[] }[]; org?: { initials: string; name: string; team: string }; user?: { initials: string; name: string; role: string }; collapsed?: boolean; defaultCollapsed?: boolean; onToggle?: (collapsed: boolean) => void; width?: number; homeHref?: string }
export interface ModalProps { label?: string; title: string; children: React.ReactNode; primaryText?: string; secondaryText?: string; onPrimary?: () => void; onSecondary?: () => void; onClose?: () => void; primaryDisabled?: boolean; inline?: boolean }

export declare const Icon: React.FC<IconProps>;
export declare const Button: React.FC<ButtonProps>;
export declare const Tag: React.FC<TagProps>;
export declare const TextInput: React.FC<TextInputProps>;
export declare const TextArea: React.FC<TextAreaProps>;
export declare const Select: React.FC<SelectProps>;
export declare const Checkbox: React.FC<CheckboxProps>;
export declare const Toggle: React.FC<ToggleProps>;
export declare const Tabs: React.FC<TabsProps>;
export declare const ContentSwitcher: React.FC<ContentSwitcherProps>;
export declare const SelectableTile: React.FC<SelectableTileProps>;
export declare const InlineNotification: React.FC<InlineNotificationProps>;
export declare const Toast: React.FC<ToastProps>;
export declare const ProgressBar: React.FC<ProgressBarProps>;
export declare const ProgressSteps: React.FC<ProgressStepsProps>;
export declare const StatTile: React.FC<StatTileProps>;
export declare const SideNav: React.FC<SideNavProps>;
export declare const Modal: React.FC<ModalProps>;
export declare const Logo: React.FC<{}>;
