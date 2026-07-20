// ─────────────────────────────────────────────────────────────────────────────
// Rate card v1 — seeded from the Brian/AJ/Mark/Wilder meeting (2026-07).
// Rates are VERSIONED DATA, not code: this document is inserted as
// pipeline_rate_cards version 1 on first use. The admin UI edits create new
// versions; existing quotes keep rendering against the version they pinned.
//
// NOTE: the Little Dipper stage no longer exists and is deliberately absent.
//
// Line fields that are LIVE LOGIC (not description text):
//   rate          number, or {tvc, mobile} for shared lines priced per venue
//   priceMode     'fixed' (default) | 'manual' (Brian types it) | 'range'
//   autoQty       day-count key the qty proposal derives from — always
//                 overridable per line ("the app proposes; Brian disposes"):
//                 'travel'|'build'|'shoot'|'strike'|'buildStrike'|'allDays'|'weeksAll'
//   requires      [lineId] — activating this line auto-activates those (with a
//                 visible note). Brian can never ship Shutter-Lock w/o Genlock.
//   flags         ['prelight'|'timecode'] — requirements we can't auto-resolve;
//                 rendered as inline warnings on the build view.
//   spec          spec-capture input shown when active (Genlock frame rate…).
//   perAsset      prompts for asset count when activated; qty = count.
//   bundle        component roles listed (not priced) — expand into handoff crew.
//   included      $0 "Incl" component rows under a package line (Hercules).
//   internal      internal-only annotation layer — build view only, NEVER on
//                 the client PDF (the Hercules panel floor lives here).
//   crewRole      role name this line contributes to the production handoff.
// ─────────────────────────────────────────────────────────────────────────────

export const DISCOUNT_LABELS = [
  'First-Time Client',
  'Non-Precedential',
  'Budget-Match',
  'Repeat-Client',
  'Custom',
]

export const FRAME_RATES = ['23.98', '24', '30', '59.94', '60']

const LINES = {
  // ═══ TVC — Virtual Production Crew (bundles: one price, components listed) ═══
  core_crew: {
    name: 'CORE CREW', unit: 'Days', rate: 10000, hours: '12hrs', autoQty: 'shoot',
    description: '3D/Unreal crew — full virtual production team, 12hr day.',
    bundle: ['Virtual Production Supervisor', 'Engine Operators', 'Tracking Operators', 'Assistants', 'Stage Manager'],
    crewRole: 'Core Crew (3D/Unreal)',
  },
  playback_crew: {
    name: 'PLAYBACK CREW', unit: 'Days', rate: 5000, hours: '12hrs', autoQty: 'shoot',
    description: '2D crew — playback team, 12hr day.',
    bundle: ['Virtual Production Supervisor', 'Playback Operators', 'Stage Manager'],
    crewRole: 'Playback Crew (2D)',
  },
  led_tech_tvc: {
    name: 'LED TECH', unit: 'Days', rate: 750, hours: '12hrs', autoQty: 'shoot',
    description: 'Standalone LED technician, 12hr day.',
    crewRole: 'LED Technician',
  },

  // ═══ TVC — Virtual Wall Package: Big Dipper Stage ═══
  bd_wall: {
    name: '1.9mm Pixel Pitch LED Wall', unit: 'Days', rate: 15000, autoQty: 'shoot',
    description: "60'x21' flat wall — 428 Planar CLI 1.9mm 120hz cabinets, 8 Colorlight Z8T units, 24 H10 fiber converters.",
  },
  bd_prep_strike: {
    name: 'Prep/Strike Days (Wall)', unit: 'Days', rate: 5000, autoQty: 'buildStrike',
    description: 'Wall prep and strike days.',
  },
  bd_tracking: {
    name: 'Prime 41x Optitrack Tracking System', unit: 'Days', rate: 15000, autoQty: 'shoot',
    description: '60 Prime 41x cameras.',
  },
  bd_server: {
    name: 'Custom Dual-8 Node Server System', unit: 'Days', rate: 2500, autoQty: 'shoot',
    description: 'Dual-8 node server system.',
  },
  bd_datacenter: {
    name: 'Data Center', unit: 'Days', rate: 1000, autoQty: 'shoot',
    description: 'Backup power, fiber, AC.',
  },
  bd_facility: {
    name: 'Facility Usage', unit: 'Days', rate: 5000, autoQty: 'shoot',
    description: 'Includes power.',
  },
  bd_techviz: {
    name: 'Tech-Viz/Pipeline', unit: 'Days', rate: 5000, autoQty: 'shoot',
    description: 'Tech-viz and pipeline services.',
  },

  // ═══ TVC — Rolling Reflection Walls ═══
  rolling_20x12: {
    name: "1.9mm 20'x12' Rolling LED Wall", unit: 'Days', rate: 5000, autoQty: 'shoot',
    description: 'Rolling reflection wall, 1.9mm pixel pitch.',
  },
  rolling_10x12: {
    name: "1.9mm 10'x12' Rolling LED Wall", unit: 'Days', rate: 2500, autoQty: 'shoot',
    description: 'Rolling reflection wall, 1.9mm pixel pitch.',
  },

  // ═══ TVC — Additional Services ═══
  preprod_planning: {
    name: 'PreProduction Planning', unit: 'Days', rate: 250,
    description: 'Pre-production planning days.',
  },
  installation_fees: {
    name: 'Installation Fees', unit: 'Allow', priceMode: 'manual',
    description: 'Scope-based — priced per job.',
  },
  optimization_tvc: {
    name: 'Optimization', unit: 'Allow', rate: 1000,
    description: 'Content optimization allowance.',
  },

  // ═══ Mobile — Virtual Production Supervisor (day-type IS the price driver) ═══
  vps_preprod: {
    name: 'VP Supervisor — Preproduction', unit: 'Days', rate: 800, hours: '8hrs',
    description: 'Preproduction day, 8hrs.', crewRole: 'Virtual Production Supervisor',
  },
  vps_loadin: {
    name: 'VP Supervisor — Load-in / On-Set Prep', unit: 'Days', rate: 600, hours: '8hrs', autoQty: 'build',
    description: 'Load-in / on-set prep day, 8hrs.', crewRole: 'Virtual Production Supervisor',
  },
  vps_prelight: {
    name: 'VP Supervisor — Pre-Light', unit: 'Days', rate: 1200, hours: '12hrs',
    description: 'Pre-light day, 12hrs.', crewRole: 'Virtual Production Supervisor',
  },
  vps_shoot: {
    name: 'VP Supervisor — Shoot', unit: 'Days', rate: 1500, hours: '12hrs', autoQty: 'shoot',
    description: 'Shoot day, 12hrs.', crewRole: 'Virtual Production Supervisor',
  },
  vps_wrap: {
    name: 'VP Supervisor — Wrap', unit: 'Days', rate: 600, hours: '8hrs', autoQty: 'strike',
    description: 'Wrap day, 8hrs.', crewRole: 'Virtual Production Supervisor',
  },

  // ═══ Mobile — LED, Servers and Processing ═══
  hercules: {
    name: 'Orbital Hercules', unit: 'Panels', rate: 117000,
    description: '600 .5m tile Planar CLI 1.9mm 60hz cabinets — all-inclusive mobile LED wall package.',
    internal: {
      panels: 600,
      perPanel: 195,
      note: 'PRG-derived rental figure: 600 panels × $195/panel = $117,000. INTERNAL COST FLOOR — nobody gets this number; the client sees the package price only.',
    },
    included: [
      { name: 'Colorlight Z8 Pro Dual 4k Image Processors', qty: 6 },
      { name: 'Colorlight Z6 Pro 4k', qty: 1 },
      { name: 'H10 Fiber Converters', qty: 4 },
      { name: 'Neutrik Signal Jumpers', qty: 600 },
      { name: 'Neutrik Power Jumpers', qty: 600 },
      { name: 'PowerCon End Runs (design-dependent)', qty: 72 },
      { name: 'Pipe Hanger Brackets (design-dependent)', qty: 140 },
      { name: '4-way Locking Clips', qty: 2400 },
      { name: '120v Power Cables / Power Distro', qty: 32 },
    ],
  },

  // ═══ Mobile — Media Servers / Playback ═══
  media_servers: {
    name: 'Media Servers', unit: '8 Nodes', rate: 1200,
    description: 'Dell custom: Dual Nvidia Quadro A6000, Dual Intel Xeon 3.1GHz 10-core, 256GB DDR4, Quadro Sync II, Pixera Playback, 4TB NVME.',
  },
  ue_licenses: {
    name: 'Unreal Engine Licenses', unit: 'Days', rate: 500, autoQty: 'shoot',
    description: 'Unreal Engine licensing.',
  },
  other_sw_licenses: {
    name: 'Other Software Licenses', unit: 'Allow', rate: 250,
    description: 'Additional software licensing.',
  },
  dp_cables: {
    name: 'DisplayPort 1.8 Cables / USB Jumpers / Keyboard-Monitor-Mouse', unit: 'Incl', rate: 0,
    description: 'Included with media servers.',
  },

  // ═══ Mobile — Optitrack System ═══
  optitrack_mobile: {
    name: 'Prime 41x Cameras', unit: 'Weeks', rate: 150, autoQty: 'weeksAll',
    description: '96 cameras — Motive software, switches, wiring.',
  },

  // ═══ Mobile — Volume Control and Labor ═══
  vad_validation: {
    name: 'VAD Validation/Optimization', unit: 'Allow', rate: 5000,
    description: 'VAD validation and optimization allowance.',
  },
  build_strike: {
    name: 'Build/Strike', unit: 'Weeks', rate: 4250, hours: '12hrs', autoQty: 'weeksAll',
    description: 'Build and strike crew, 12hr days.', crewRole: 'Build/Strike Crew',
  },
  vpe_loadin: {
    name: 'VP Engineer — Load-in', unit: 'Days', rate: 850, autoQty: 'build',
    description: 'Load-in day.', crewRole: 'VP Engineer',
  },
  vpe_prelight: {
    name: 'VP Engineer — Pre-Light', unit: 'Days', rate: 850,
    description: 'Pre-light day.', crewRole: 'VP Engineer',
  },
  vpe_shoot: {
    name: 'VP Engineer — Shoot', unit: 'Days', rate: 850, autoQty: 'shoot',
    description: 'Shoot day.', crewRole: 'VP Engineer',
  },
  vpe_wrap: {
    name: 'VP Engineer — Wrap', unit: 'Days', rate: 600, hours: '8hrs', autoQty: 'strike',
    description: 'Wrap day, 8hrs.', crewRole: 'VP Engineer',
  },
  ledtech_loadin: {
    name: 'LED Technician — Load-in', unit: 'Days', rate: 650, autoQty: 'build',
    description: 'Load-in day.', crewRole: 'LED Technician',
  },
  ledtech_prelight: {
    name: 'LED Technician — Pre-Light', unit: 'Days', rate: 650,
    description: 'Pre-light day.', crewRole: 'LED Technician',
  },
  ledtech_shoot: {
    name: 'LED Technician — Shoot', unit: 'Days', rate: 650, autoQty: 'shoot',
    description: 'Shoot day.', crewRole: 'LED Technician',
  },
  ledtech_wrap: {
    name: 'LED Technician — Wrap', unit: 'Days', rate: 650, hours: '8hr wrap', autoQty: 'strike',
    description: 'Wrap day, 8hrs.', crewRole: 'LED Technician',
  },

  // ═══ Mobile — Truss/Rigging ═══
  truss_curved: {
    name: 'Custom Curved Truss System', unit: 'Days', rate: 1250, autoQty: 'shoot',
    description: 'For LED wall.',
  },
  articulated_wall: {
    name: 'Articulated Wall/Motors', unit: 'Each', rate: 1500,
    description: 'Articulated wall sections with motors.',
  },
  rocknroll_truss: {
    name: 'Rock n Roll Truss', unit: 'Weeks', rate: 1500, autoQty: 'weeksAll',
    description: 'For tracking.',
  },

  // ═══ Mobile — Shipping/Delivery ═══
  expendables: {
    name: 'Expendables', unit: 'Allow', priceMode: 'manual',
    description: 'Job-dependent expendables allowance.',
  },
  transport_intrastate: {
    name: 'Intra-State Ground Transport', unit: 'Trips', rate: 500,
    description: 'Ground transport within state, per trip.',
  },
  transport_interstate: {
    name: 'Inter-State Ground Transport', unit: 'Trips', rate: 6000,
    description: 'Ground transport across state lines, per trip.',
  },
  transport_intl_air: {
    name: 'International Air Transport', unit: 'Allow', priceMode: 'manual',
    description: 'Priced by weight — quoted per job.',
  },

  // ═══ SHARED — Configuration (spec-capture lines; many are $0 on purpose) ═══
  genlock: {
    name: 'Genlock', unit: 'Allow', rate: 0,
    description: 'Sync generator lock — captures production frame rate.',
    spec: { type: 'select', label: 'Frame rate', options: FRAME_RATES, required: true },
  },
  lens_encoding: {
    name: 'Lens Encoding (DCS LTV-2)', unit: 'Days', rate: { tvc: 400, mobile: 300 },
    description: 'DCS LTV-2 lens encoding.',
  },
  lens_mapping: {
    name: 'Lens Mapping', unit: 'Allow', rate: 250,
    description: 'Allow 1 day prior to production.',
  },
  multicam_opt: {
    name: 'Multi-cam Optimization', unit: 'Each', rate: { tvc: 1500, mobile: 675 },
    description: 'Allow 1 additional optimization day per asset.',
    perAsset: true,
  },
  shutter_lock: {
    name: 'Shutter-Lock', unit: 'Allow', rate: { tvc: 200, mobile: 250 },
    description: 'Camera shutter phase lock.',
    requires: ['genlock'],
  },
  frame_remapping: {
    name: 'Frame Re-Mapping', unit: 'Allow', rate: 2500,
    description: 'Frame re-mapping.',
    requires: ['multicam_opt'],
  },
  cam_tracking_export: {
    name: 'Cam Tracking Data Export', unit: 'Allow', rate: 800,
    description: 'Camera tracking data export.',
    flags: ['timecode'],
  },
  pixel_mapped_lighting: {
    name: 'Pixel-Mapped Lighting (NDI feed)', unit: 'Allow', rate: { tvc: 500, mobile: 1500 },
    description: 'NDI pixel-mapped lighting feed.',
    flags: ['prelight'],
  },
  sensor_calibration: {
    name: 'Sensor Calibration', unit: 'Allow', rate: 500,
    description: 'Allow 1 day prior.',
  },
  add_wall_sync: {
    name: 'Additional LED Wall Sync', unit: 'Allow', rate: 500,
    description: 'Sync for an additional LED wall.',
  },
  live_mocap: {
    name: 'Live MOCAP (Optitrack — video or suits)', unit: 'Allow', priceMode: 'manual',
    description: 'Live motion capture — priced per scope.',
  },
  add_tracking_system: {
    name: 'Additional Tracking System', unit: 'Allow', priceMode: 'manual',
    description: 'As requested.',
  },

  // ═══ SHARED — Equipment Rentals ═══
  camera_package: {
    name: 'Camera Package', unit: 'Days', priceMode: 'range', range: [2500, 3500],
    description: 'Red V-Raptor XL-X / Sony Venice — list on request.',
  },
  lighting_grip: {
    name: 'Lighting/Grip Package', unit: 'Days', priceMode: 'range', range: [1600, 2800],
    description: 'List on request.',
  },
  crane_24: {
    name: "24' Telescoping Crane w/ Ronin 2 Head + Op", unit: 'Days', rate: 4500,
    description: 'Crane with operator.',
  },
  sisu_c20: {
    name: 'SISU C20 Cinema Robot w/ Op', unit: 'Days', rate: 4500,
    description: 'Cinema robot with operator.',
  },
  sisu_c31: {
    name: 'SISU C31 w/ Op', unit: 'Days', rate: 6000,
    description: 'Cinema robot with operator.',
  },
  scissor_lift: {
    name: 'Scissor Lift w/ Op', unit: 'Days', rate: 250,
    description: 'Scissor lift with operator.',
  },
  forklift: {
    name: 'Forklift w/ Op', unit: 'Days', priceMode: 'range', range: [250, 350],
    description: 'Forklift with operator.',
  },
  additional_ge: {
    name: 'Additional G&E (provided by MBS)', unit: 'Allow', priceMode: 'manual',
    description: 'All G&E goes through MBS or the client pays a fee.',
  },

  // ═══ SHARED — Additional Services ═══
  vad_design: {
    name: 'VAD Design', unit: 'Days', rate: 1500,
    description: 'Per artist, per day.',
  },
  location_scanning: {
    name: 'Location Scanning', unit: 'Hours', rate: 500,
    description: 'Location scanning services.',
  },
  object_scanning: {
    name: 'Object Scanning', unit: 'Hours', rate: 500,
    description: 'Photogrammetry — no reflective surfaces.',
  },
  gaussian_splatting: {
    name: 'Gaussian Splatting', unit: 'Hours', rate: 400,
    description: 'Gaussian splat capture and processing.',
  },
  fiber_internet: {
    name: 'Secure 100Gb Fiber Internet', unit: 'Days', rate: 6000,
    description: 'Secure high-bandwidth connectivity.',
  },
  virtual_scouting: {
    name: 'Virtual Scouting / Previz Sessions', unit: 'Hours', rate: 1500,
    description: 'Virtual scouting and previz.',
  },
  workflow_coordination: {
    name: 'Workflow Coordination', unit: 'Days', rate: 250,
    description: 'Cross-department workflow coordination.',
  },
}

// Shared modules — identical on both templates, modeled once, referenced twice.
const SHARED_SECTIONS = [
  {
    id: 'configuration', title: 'Configuration',
    lines: ['genlock', 'lens_encoding', 'lens_mapping', 'multicam_opt', 'shutter_lock',
            'frame_remapping', 'cam_tracking_export', 'pixel_mapped_lighting',
            'sensor_calibration', 'add_wall_sync', 'live_mocap', 'add_tracking_system'],
  },
  {
    id: 'equipment_rentals', title: 'Equipment Rentals',
    note: 'All G&E goes through MBS or the client pays a fee.',
    lines: ['camera_package', 'lighting_grip', 'crane_24', 'sisu_c20', 'sisu_c31',
            'scissor_lift', 'forklift', 'additional_ge'],
  },
  {
    id: 'additional_services', title: 'Additional Services',
    lines: ['vad_design', 'location_scanning', 'object_scanning', 'gaussian_splatting',
            'fiber_internet', 'virtual_scouting', 'workflow_coordination'],
  },
]

export const RATE_CARD_V1 = {
  version: 1,
  label: 'Seed v1 — 2026-07 (new TVC facility)',
  discountLabels: DISCOUNT_LABELS,
  lines: LINES,
  templates: {
    tvc: {
      title: 'Television City (TVC)',
      sections: [
        {
          id: 'vp_crew', title: 'Virtual Production Crew',
          lines: ['core_crew', 'playback_crew', 'led_tech_tvc'],
        },
        {
          id: 'big_dipper', title: 'Virtual Wall Package — Big Dipper Stage',
          lines: ['bd_wall', 'bd_prep_strike', 'bd_tracking', 'bd_server',
                  'bd_datacenter', 'bd_facility', 'bd_techviz'],
        },
        {
          id: 'rolling_walls', title: 'Rolling Reflection Walls',
          lines: ['rolling_20x12', 'rolling_10x12'],
        },
        {
          id: 'tvc_services', title: 'Additional TVC Services',
          lines: ['preprod_planning', 'installation_fees', 'optimization_tvc'],
        },
        ...SHARED_SECTIONS,
      ],
    },
    mobile: {
      title: 'In Orbit (Mobile)',
      sections: [
        {
          id: 'vp_supervisor', title: 'Virtual Production Supervisor',
          lines: ['vps_preprod', 'vps_loadin', 'vps_prelight', 'vps_shoot', 'vps_wrap'],
        },
        {
          id: 'led_servers', title: 'LED, Servers and Processing',
          lines: ['hercules'],
        },
        {
          id: 'media_servers', title: 'Media Servers / Playback',
          lines: ['media_servers', 'ue_licenses', 'other_sw_licenses', 'dp_cables'],
        },
        {
          id: 'optitrack', title: 'Optitrack System',
          lines: ['optitrack_mobile'],
        },
        {
          id: 'volume_labor', title: 'Volume Control and Labor',
          lines: ['vad_validation', 'build_strike',
                  'vpe_loadin', 'vpe_prelight', 'vpe_shoot', 'vpe_wrap',
                  'ledtech_loadin', 'ledtech_prelight', 'ledtech_shoot', 'ledtech_wrap'],
        },
        {
          id: 'truss_rigging', title: 'Truss/Rigging',
          lines: ['truss_curved', 'articulated_wall', 'rocknroll_truss'],
        },
        {
          id: 'shipping', title: 'Shipping/Delivery',
          lines: ['expendables', 'transport_intrastate', 'transport_interstate', 'transport_intl_air'],
        },
        ...SHARED_SECTIONS,
      ],
    },
  },
  // Stage presets: one choice replaces six manual toggles. Big Dipper turns on
  // the wall + its infrastructure stack; tracking stays a question (always ask).
  presets: {
    bigDipper: {
      label: 'Big Dipper Stage',
      venue: 'tvc',
      activates: ['bd_wall', 'bd_prep_strike', 'bd_server', 'bd_datacenter', 'bd_facility', 'bd_techviz'],
      optional: ['bd_tracking'],
      optionalPrompt: 'Add the Prime 41x Optitrack tracking system? (always ask)',
    },
  },
}
