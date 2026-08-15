import React from 'react'

const Icon = ({ children, size = 18, ...props }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>
export const ChevronDown = props => <Icon {...props}><path d="m6 9 6 6 6-6" /></Icon>
export const ChevronRight = props => <Icon {...props}><path d="m9 18 6-6-6-6" /></Icon>
export const Check = props => <Icon {...props}><path d="m5 12 4 4L19 6" /></Icon>
export const Copy = props => <Icon {...props}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></Icon>
export const AlertTriangle = props => <Icon {...props}><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></Icon>
export const CircleAlert = props => <Icon {...props}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></Icon>
export const Clock = props => <Icon {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>
export const FileCheck = props => <Icon {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8Z"/><path d="M14 2v6h6M8 14l2 2 4-4"/></Icon>
export const Inbox = props => <Icon {...props}><path d="M4 4h16v14H4zM4 13h4l2 3h4l2-3h4"/></Icon>
export const Search = props => <Icon {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></Icon>
export const MessageSquare = props => <Icon {...props}><path d="M4 4h16v12H8l-4 4Z"/></Icon>
export const Building = props => <Icon {...props}><path d="M4 21V3h11v18M15 9h5v12M8 7h3M8 11h3M8 15h3"/></Icon>
export const Flask = props => <Icon {...props}><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M8 15h8"/></Icon>
export const Refresh = props => <Icon {...props}><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18 6l2 6M18 16a7 7 0 0 1-12 2l-2-6"/></Icon>
export const ExternalLink = props => <Icon {...props}><path d="M14 4h6v6M20 4l-9 9M18 13v7H4V6h7"/></Icon>
export const ArrowLeft = props => <Icon {...props}><path d="m15 18-6-6 6-6M9 12h11"/></Icon>
export const Sliders = props => <Icon {...props}><path d="M4 6h16M7 12h10M10 18h4"/></Icon>
export const Plus = props => <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>
export const Trash = props => <Icon {...props}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13"/></Icon>
export const RotateBack = props => <Icon {...props}><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/></Icon>
export const Activity = props => <Icon {...props}><path d="M3 12h4l3 8 4-16 3 8h4"/></Icon>
export const Pencil = props => <Icon {...props}><path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="m14 6 4 4"/></Icon>
