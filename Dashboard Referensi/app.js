<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>GeoMetrics Pro - Dashboard</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=Space+Grotesk:wght@500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "surface-container-highest": "#31353d",
                        "primary": "#adc6ff",
                        "outline": "#8b90a0",
                        "tertiary-container": "#c863fb",
                        "on-secondary-container": "#006a70",
                        "surface-bright": "#363942",
                        "on-primary": "#002e69",
                        "surface-container": "#1c2028",
                        "primary-container": "#4b8eff",
                        "on-tertiary-fixed": "#310048",
                        "background": "#10131b",
                        "on-primary-fixed": "#001a41",
                        "surface-container-lowest": "#0b0e16",
                        "tertiary-fixed": "#f6d9ff",
                        "secondary-container": "#00f1fe",
                        "on-primary-fixed-variant": "#004493",
                        "on-tertiary-fixed-variant": "#7200a3",
                        "error": "#ffb4ab",
                        "secondary-fixed": "#74f5ff",
                        "on-background": "#e0e2ed",
                        "outline-variant": "#414755",
                        "on-primary-container": "#00285c",
                        "inverse-surface": "#e0e2ed",
                        "surface-tint": "#adc6ff",
                        "secondary-fixed-dim": "#00dbe7",
                        "surface-container-low": "#181c23",
                        "on-secondary-fixed": "#002022",
                        "on-secondary": "#00363a",
                        "surface-container-high": "#272a32",
                        "surface": "#10131b",
                        "primary-fixed-dim": "#adc6ff",
                        "on-tertiary-container": "#460066",
                        "secondary": "#ddfcff",
                        "surface-dim": "#10131b",
                        "tertiary": "#e9b3ff",
                        "on-error": "#690005",
                        "primary-fixed": "#d8e2ff",
                        "on-secondary-fixed-variant": "#004f54",
                        "on-tertiary": "#510074",
                        "inverse-primary": "#005bc1",
                        "on-surface": "#e0e2ed",
                        "inverse-on-surface": "#2d3039",
                        "surface-variant": "#31353d",
                        "on-surface-variant": "#c1c6d7",
                        "error-container": "#93000a",
                        "on-error-container": "#ffdad6",
                        "tertiary-fixed-dim": "#e9b3ff"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.125rem",
                        "lg": "0.25rem",
                        "xl": "0.5rem",
                        "full": "0.75rem"
                    },
                    "spacing": {
                        "unit": "4px",
                        "stack-gap-md": "1rem",
                        "gutter": "1.5rem",
                        "panel-padding": "1rem",
                        "stack-gap-sm": "0.5rem",
                        "margin": "2rem"
                    },
                    "fontFamily": {
                        "headline-md": ["Inter"],
                        "label-caps": ["Space Grotesk"],
                        "data-mono": ["Space Grotesk"],
                        "body-base": ["Inter"],
                        "metric-xl": ["Space Grotesk"],
                        "headline-lg": ["Inter"]
                    },
                    "fontSize": {
                        "headline-md": ["24px", {"lineHeight": "1.3", "fontWeight": "600"}],
                        "label-caps": ["12px", {"lineHeight": "1", "letterSpacing": "0.05em", "fontWeight": "600"}],
                        "data-mono": ["14px", {"lineHeight": "1.4", "fontWeight": "500"}],
                        "body-base": ["16px", {"lineHeight": "1.5", "fontWeight": "400"}],
                        "metric-xl": ["48px", {"lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700"}],
                        "headline-lg": ["32px", {"lineHeight": "1.2", "letterSpacing": "-0.01em", "fontWeight": "600"}]
                    }
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        body {
            background-color: #10131b;
        }
        ::-webkit-scrollbar {
            width: 4px;
        }
        ::-webkit-scrollbar-track {
            background: #1c2028;
        }
        ::-webkit-scrollbar-thumb {
            background: #31353d;
        }
    </style>
</head>
<body class="bg-background text-on-surface font-body-base">
<!-- SideNavBar -->
<aside class="h-screen w-64 border-r border-[#3A3A3C] fixed left-0 top-0 bg-[#2C2C2E] dark:bg-[#1C1C1E] flex flex-col justify-between py-6 z-50 font-inter text-sm antialiased tracking-tight">
<div>
<div class="px-6 mb-10">
<div class="flex items-center gap-3">
<div class="w-8 h-8 bg-primary rounded flex items-center justify-center">
<span class="material-symbols-outlined text-on-primary-container" style="font-variation-settings: 'FILL' 1;">explore</span>
</div>
<div>
<h1 class="text-lg font-black tracking-tighter text-white uppercase">GeoMetrics</h1>
<p class="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Precision Geospatial</p>
</div>
</div>
</div>
<nav class="space-y-1 px-3">
<a class="flex items-center gap-3 px-3 py-2.5 text-blue-500 border-r-2 border-blue-500 font-semibold bg-blue-500/5 transition-all" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span>Dashboard</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 transition-all" href="#">
<span class="material-symbols-outlined" data-icon="location_on">location_on</span>
<span>Places</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 transition-all" href="#">
<span class="material-symbols-outlined" data-icon="query_stats">query_stats</span>
<span>Analytics</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 transition-all" href="#">
<span class="material-symbols-outlined" data-icon="trending_up">trending_up</span>
<span>Insights</span>
</a>
</nav>
<div class="mt-8 px-6">
<button class="w-full bg-primary-container text-on-primary-container py-2 rounded font-semibold text-xs transition-transform active:scale-95">
                    Generate Report
                </button>
</div>
</div>
<div class="px-3 space-y-1">
<a class="flex items-center gap-3 px-3 py-2 text-gray-400 hover:text-white hover:bg-white/5 transition-all" href="#">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
<span>Settings</span>
</a>
<a class="flex items-center gap-3 px-3 py-2 text-gray-400 hover:text-white hover:bg-white/5 transition-all" href="#">
<span class="material-symbols-outlined" data-icon="help_outline">help_outline</span>
<span>Support</span>
</a>
</div>
</aside>
<!-- TopNavBar -->
<header class="w-full h-14 border-b border-[#3A3A3C] sticky top-0 z-40 bg-[#1C1C1E]/90 backdrop-blur-lg flex items-center justify-between px-8 ml-64 font-inter text-xs tracking-wide">
<div class="flex items-center gap-8">
<span class="text-base font-bold text-white">GeoMetrics Pro</span>
<div class="relative">
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">search</span>
<input class="bg-[#2C2C2E] border-none rounded py-1.5 pl-9 pr-4 text-xs w-64 focus:ring-1 focus:ring-blue-500 text-on-surface" placeholder="Search coordinates, places, or layers..." type="text"/>
</div>
</div>
<div class="flex items-center gap-6 pr-64">
<div class="flex items-center gap-4 border-r border-[#3A3A3C] pr-6 mr-2">
<button class="text-gray-500 hover:text-blue-400 transition-colors active:scale-95 duration-75">
<span class="material-symbols-outlined" data-icon="notifications">notifications</span>
</button>
<button class="text-gray-500 hover:text-blue-400 transition-colors active:scale-95 duration-75">
<span class="material-symbols-outlined" data-icon="history">history</span>
</button>
<button class="text-gray-500 hover:text-blue-400 transition-colors active:scale-95 duration-75">
<span class="material-symbols-outlined" data-icon="download">download</span>
</button>
</div>
<div class="flex items-center gap-3 cursor-pointer group">
<div class="text-right">
<p class="text-white font-medium">Alex Rivera</p>
<p class="text-[10px] text-gray-500">Chief Analyst</p>
</div>
<img alt="User Profile" class="w-8 h-8 rounded-full border border-[#3A3A3C] group-hover:border-blue-500 transition-colors" data-alt="Professional corporate headshot of a man with clean-cut hair and a friendly expression in a modern office setting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCubbl9AqFt9Anbj9yfI2C3N4fbXav6A9LYwQdIe5xp1ge4khIfkJ1HYHGkZs58-7g5XPuh30H3XlGzL1yosK2UaWxbBAx3OCpJMXBcfWDTa6zYtlVBFLFzQ_tK6lJIbTxYj5SiqNKmu9rzCvTC_IxO8iQ-LhbaUnKRGcePxG008uDJ00uj_d4kaqAOsVLRu8PzffURBMfvmJwJTGc5x2uILg0a4SXWc7N1kkd6VXz5cghvWkQh3Ki5g13cWiOJNrKufUXL9-t_torT"/>
</div>
</div>
</header>
<!-- Main Canvas -->
<main class="ml-64 min-h-[calc(100vh-3.5rem)] relative">
<!-- Interactive Map Background -->
<div class="absolute inset-0 z-0 bg-surface-container-lowest">
<img alt="Dark satellite map view of an urban metropolitan area" class="w-full h-full object-cover opacity-60" data-alt="Highly detailed dark satellite imagery of a sprawling metropolitan city with neon light trails and intricate road networks" data-location="Tokyo" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBkwAathReSEIXqD1kIz4XDbSp9pd3nGkexi_fzMnUfyjGJFsR_floPiOCw7HfNbLXvn4ClonOXhHXuNL216wbDFK948marOaSs8fjGfktdSyR3OAAFd_lzSifG3zJeMzXBAa_mRyOC6MGBlsC8-_RY5bE036CbUxd2rn6dnbSmHHTeDiqp6aXV3HiIWCykX6LjTsQL39AabRhkJRuT2TVf4PldOGudmfGCHCg3YCbZL6MP6nPV83SNaKzZ5-KCswEbxGuMRidk1cyH"/>
<!-- Map UI Overlays (Pins) -->
<div class="absolute top-1/4 left-1/3 group cursor-pointer">
<div class="w-4 h-4 bg-primary rounded-full animate-pulse shadow-[0_0_15px_rgba(173,198,255,0.8)]"></div>
<div class="absolute -top-12 -left-1/2 hidden group-hover:block bg-[#2C2C2E] border border-[#3A3A3C] p-2 rounded whitespace-nowrap z-20">
<p class="text-[10px] font-label-caps text-primary">ID: 44921-X</p>
<p class="text-xs font-bold text-white">Central Logistics Hub</p>
</div>
</div>
<div class="absolute bottom-1/3 right-1/4 group cursor-pointer">
<div class="w-4 h-4 bg-secondary-container rounded-full animate-pulse shadow-[0_0_15px_rgba(0,241,254,0.8)]"></div>
<div class="absolute -top-12 -left-1/2 hidden group-hover:block bg-[#2C2C2E] border border-[#3A3A3C] p-2 rounded whitespace-nowrap z-20">
<p class="text-[10px] font-label-caps text-secondary-container">ID: 88203-Z</p>
<p class="text-xs font-bold text-white">Waterfront Terminal</p>
</div>
</div>
</div>
<!-- Floating Controls -->
<div class="absolute top-6 right-6 flex flex-col gap-3 z-30">
<div class="bg-[#1C1C1E]/80 backdrop-blur-md p-1.5 rounded-lg border border-[#3A3A3C] flex flex-col gap-1">
<button class="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded transition-colors">
<span class="material-symbols-outlined">add</span>
</button>
<div class="h-px bg-[#3A3A3C] mx-2"></div>
<button class="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded transition-colors">
<span class="material-symbols-outlined">remove</span>
</button>
</div>
<button class="w-10 h-10 bg-[#1C1C1E]/80 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/10 rounded-lg border border-[#3A3A3C] transition-colors">
<span class="material-symbols-outlined">layers</span>
</button>
<button class="w-10 h-10 bg-primary-container flex items-center justify-center text-on-primary-container rounded-lg shadow-xl transition-transform active:scale-95">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">my_location</span>
</button>
</div>
<!-- Content Overlay Grid -->
<div class="relative z-10 p-gutter pointer-events-none grid grid-cols-12 gap-gutter h-full">
<!-- Top Metric Row -->
<div class="col-span-12 pointer-events-auto flex gap-4 overflow-x-auto pb-4">
<div class="min-w-[240px] flex-1 bg-[#1C1C1E]/60 backdrop-blur-xl border border-[#3A3A3C] p-panel-padding rounded-xl">
<div class="flex justify-between items-start mb-2">
<span class="text-[10px] font-label-caps text-gray-400 uppercase tracking-widest">Total Places</span>
<span class="material-symbols-outlined text-primary text-sm">location_on</span>
</div>
<div class="text-metric-xl font-metric-xl text-white">12,482</div>
<div class="flex items-center gap-1 mt-1">
<span class="material-symbols-outlined text-[14px] text-green-400">trending_up</span>
<span class="text-[11px] font-data-mono text-green-400">+4.2%</span>
<span class="text-[11px] text-gray-500 ml-1">from last month</span>
</div>
</div>
<div class="min-w-[240px] flex-1 bg-[#1C1C1E]/60 backdrop-blur-xl border border-[#3A3A3C] p-panel-padding rounded-xl">
<div class="flex justify-between items-start mb-2">
<span class="text-[10px] font-label-caps text-gray-400 uppercase tracking-widest">Active Categories</span>
<span class="material-symbols-outlined text-secondary-container text-sm">category</span>
</div>
<div class="text-metric-xl font-metric-xl text-white">18</div>
<div class="flex items-center gap-1 mt-1">
<span class="text-[11px] font-data-mono text-gray-400">Target: 20</span>
<div class="w-full h-1 bg-white/10 rounded-full ml-2 overflow-hidden">
<div class="w-[90%] h-full bg-secondary-container"></div>
</div>
</div>
</div>
<div class="min-w-[240px] flex-1 bg-[#1C1C1E]/60 backdrop-blur-xl border border-[#3A3A3C] p-panel-padding rounded-xl">
<div class="flex justify-between items-start mb-2">
<span class="text-[10px] font-label-caps text-gray-400 uppercase tracking-widest">Growth Velocity</span>
<span class="material-symbols-outlined text-tertiary text-sm">bolt</span>
</div>
<div class="text-metric-xl font-metric-xl text-white">84.2</div>
<div class="flex items-center gap-1 mt-1">
<span class="material-symbols-outlined text-[14px] text-primary">signal_cellular_alt</span>
<span class="text-[11px] font-data-mono text-primary">Optimal</span>
<span class="text-[11px] text-gray-500 ml-1">Processing speed</span>
</div>
</div>
</div>
<!-- Side Panels -->
<div class="col-span-4 space-y-gutter pointer-events-auto h-full flex flex-col pb-gutter">
<!-- Category Chart Widget -->
<div class="bg-[#1C1C1E]/80 backdrop-blur-xl border border-[#3A3A3C] p-panel-padding rounded-xl flex-1 flex flex-col">
<div class="flex justify-between items-center mb-6">
<h3 class="font-label-caps text-white text-[12px] uppercase">Distribution by Category</h3>
<button class="text-gray-500 hover:text-white"><span class="material-symbols-outlined text-sm">more_vert</span></button>
</div>
<div class="flex-1 flex flex-col justify-between py-2">
<!-- Custom Bar Chart UI -->
<div class="space-y-4">
<div class="space-y-1">
<div class="flex justify-between text-[11px] font-data-mono">
<span class="text-gray-400">Retail Clusters</span>
<span class="text-white">45%</span>
</div>
<div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
<div class="w-[45%] h-full bg-primary"></div>
</div>
</div>
<div class="space-y-1">
<div class="flex justify-between text-[11px] font-data-mono">
<span class="text-gray-400">Industrial Zones</span>
<span class="text-white">28%</span>
</div>
<div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
<div class="w-[28%] h-full bg-secondary-container"></div>
</div>
</div>
<div class="space-y-1">
<div class="flex justify-between text-[11px] font-data-mono">
<span class="text-gray-400">Residential Areas</span>
<span class="text-white">15%</span>
</div>
<div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
<div class="w-[15%] h-full bg-tertiary"></div>
</div>
</div>
<div class="space-y-1">
<div class="flex justify-between text-[11px] font-data-mono">
<span class="text-gray-400">Public Spaces</span>
<span class="text-white">12%</span>
</div>
<div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
<div class="w-[12%] h-full bg-white/20"></div>
</div>
</div>
</div>
<div class="mt-8 pt-6 border-t border-[#3A3A3C]">
<div class="flex items-center justify-between text-[11px] mb-4">
<span class="text-gray-400">Recent Growth</span>
<span class="text-green-400 font-bold">+128 new pins</span>
</div>
<div class="flex -space-x-2">
<div class="w-6 h-6 rounded-full border-2 border-[#1C1C1E] bg-[#2C2C2E] flex items-center justify-center">
<span class="material-symbols-outlined text-[12px] text-primary" style="font-variation-settings: 'FILL' 1;">circle</span>
</div>
<div class="w-6 h-6 rounded-full border-2 border-[#1C1C1E] bg-[#2C2C2E] flex items-center justify-center">
<span class="material-symbols-outlined text-[12px] text-secondary-container" style="font-variation-settings: 'FILL' 1;">square</span>
</div>
<div class="w-6 h-6 rounded-full border-2 border-[#1C1C1E] bg-[#2C2C2E] flex items-center justify-center">
<span class="material-symbols-outlined text-[12px] text-tertiary" style="font-variation-settings: 'FILL' 1;">change_history</span>
</div>
</div>
</div>
</div>
</div>
<!-- Activity Log Widget -->
<div class="bg-[#1C1C1E]/80 backdrop-blur-xl border border-[#3A3A3C] p-panel-padding rounded-xl max-h-[300px] overflow-hidden">
<h3 class="font-label-caps text-white text-[12px] uppercase mb-4">Regional Distribution</h3>
<div class="flex items-center gap-6">
<div class="relative w-24 h-24">
<svg class="w-full h-full -rotate-90" viewbox="0 0 36 36">
<circle class="stroke-white/5" cx="18" cy="18" fill="none" r="16" stroke-width="4"></circle>
<circle class="stroke-primary" cx="18" cy="18" fill="none" r="16" stroke-dasharray="60 100" stroke-width="4"></circle>
<circle class="stroke-secondary-container" cx="18" cy="18" fill="none" r="16" stroke-dasharray="25 100" stroke-dashoffset="-60" stroke-width="4"></circle>
<circle class="stroke-tertiary" cx="18" cy="18" fill="none" r="16" stroke-dasharray="15 100" stroke-dashoffset="-85" stroke-width="4"></circle>
</svg>
</div>
<div class="space-y-2">
<div class="flex items-center gap-2">
<div class="w-2 h-2 rounded-full bg-primary"></div>
<span class="text-[11px] text-gray-400">North Sector</span>
</div>
<div class="flex items-center gap-2">
<div class="w-2 h-2 rounded-full bg-secondary-container"></div>
<span class="text-[11px] text-gray-400">Core Center</span>
</div>
<div class="flex items-center gap-2">
<div class="w-2 h-2 rounded-full bg-tertiary"></div>
<span class="text-[11px] text-gray-400">Peripheral</span>
</div>
</div>
</div>
</div>
</div>
<!-- Main Content Area (Bottom Bar Overlay) -->
<div class="col-span-8 flex flex-col justify-end pointer-events-none pb-gutter">
<div class="bg-[#1C1C1E]/90 backdrop-blur-xl border border-[#3A3A3C] rounded-xl pointer-events-auto shadow-2xl overflow-hidden">
<div class="flex items-center justify-between border-b border-[#3A3A3C] px-6 py-4">
<div class="flex items-center gap-4">
<h2 class="text-white font-bold text-sm">Real-time Location Stream</h2>
<div class="flex items-center gap-2 px-2 py-1 bg-green-500/10 rounded">
<div class="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
<span class="text-[10px] text-green-500 font-bold uppercase tracking-widest">Live Sync</span>
</div>
</div>
<div class="flex gap-2">
<button class="px-3 py-1 bg-white/5 hover:bg-white/10 text-white text-[10px] font-label-caps rounded transition-colors uppercase">Filter</button>
<button class="px-3 py-1 bg-white/5 hover:bg-white/10 text-white text-[10px] font-label-caps rounded transition-colors uppercase">Export</button>
</div>
</div>
<div class="p-0">
<table class="w-full text-left text-xs">
<thead>
<tr class="bg-white/2 border-b border-[#3A3A3C]">
<th class="px-6 py-3 font-label-caps text-gray-400 font-medium">Coordinate Ref</th>
<th class="px-6 py-3 font-label-caps text-gray-400 font-medium">Category</th>
<th class="px-6 py-3 font-label-caps text-gray-400 font-medium">Status</th>
<th class="px-6 py-3 font-label-caps text-gray-400 font-medium text-right">Last Update</th>
</tr>
</thead>
<tbody class="divide-y divide-[#3A3A3C]">
<tr class="hover:bg-white/[0.02] transition-colors cursor-pointer group">
<td class="px-6 py-3 font-data-mono text-primary">35.6895° N, 139.6917° E</td>
<td class="px-6 py-3">
<span class="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold">RETAIL</span>
</td>
<td class="px-6 py-3 flex items-center gap-2">
<span class="material-symbols-outlined text-green-400 text-[14px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
<span class="text-on-surface-variant">Verified</span>
</td>
<td class="px-6 py-3 text-right text-gray-500">2m ago</td>
</tr>
<tr class="hover:bg-white/[0.02] transition-colors cursor-pointer group">
<td class="px-6 py-3 font-data-mono text-primary">40.7128° N, 74.0060° W</td>
<td class="px-6 py-3">
<span class="px-2 py-0.5 bg-secondary-container/10 text-secondary-container rounded-full text-[10px] font-bold">LOGISTICS</span>
</td>
<td class="px-6 py-3 flex items-center gap-2">
<span class="material-symbols-outlined text-yellow-400 text-[14px]" style="font-variation-settings: 'FILL' 1;">pending</span>
<span class="text-on-surface-variant">Reviewing</span>
</td>
<td class="px-6 py-3 text-right text-gray-500">14m ago</td>
</tr>
<tr class="hover:bg-white/[0.02] transition-colors cursor-pointer group">
<td class="px-6 py-3 font-data-mono text-primary">51.5074° N, 0.1278° W</td>
<td class="px-6 py-3">
<span class="px-2 py-0.5 bg-tertiary/10 text-tertiary rounded-full text-[10px] font-bold">PUBLIC</span>
</td>
<td class="px-6 py-3 flex items-center gap-2">
<span class="material-symbols-outlined text-green-400 text-[14px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
<span class="text-on-surface-variant">Verified</span>
</td>
<td class="px-6 py-3 text-right text-gray-500">32m ago</td>
</tr>
</tbody>
</table>
</div>
</div>
</div>
</div>
</main>
</body></html>