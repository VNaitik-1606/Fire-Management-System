function base(props) {
  return {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...props,
  };
}

export function FlameIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 2c1.5 4 5 5.5 5 9.5A5 5 0 0 1 7 11.5C7 9 8.5 7.5 9.5 6c.6 1.6 1.4 2.2 2.5 2.5C12.6 6.6 12.4 4.4 12 2Z" />
      <path d="M12 22a5 5 0 0 0 5-5c0-2.2-1.7-3.6-3-5.5-1 1.6-2 2-3.2 2.4.3 1.6-.3 2.2-1 2.9" />
    </svg>
  );
}

export function GridIcon(props) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function MapIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="m9 4 6 2 6-2v16l-6 2-6-2-6 2V6l6-2Z" />
      <path d="M9 4v16M15 6v16" />
    </svg>
  );
}

export function ClipboardIcon(props) {
  return (
    <svg {...base(props)}>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

export function ChartIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M3 3v18h18" />
      <path d="M7 15l3.5-4 3 2.5L20 7" />
    </svg>
  );
}

export function ShieldIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function SatelliteIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="m7 12 5 5 4-4-5-5-4 4Z" />
      <path d="M4 15 2 17l5 5 2-2M14 4l2-2 5 5-2 2" />
      <path d="m12 7 3-3M17 12l3-3" />
      <circle cx="17.5" cy="17.5" r="3.5" />
    </svg>
  );
}

export function UsersIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function SearchIcon(props) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function ArrowUpIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function ArrowDownIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M18 13l-6 6-6-6" />
    </svg>
  );
}

export function AlertIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M10.3 3.6 2.4 17a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function ClockIcon(props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function CheckIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="m4 12 5 5L20 6" />
    </svg>
  );
}

export function PlusIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function RefreshIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

export function LayersIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

export function LogoutIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </svg>
  );
}

export function PinIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function FileIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}
