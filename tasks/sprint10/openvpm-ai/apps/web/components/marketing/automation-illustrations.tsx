"use client";

import React from "react";

interface IllustrationProps {
  className?: string;
  enabled?: boolean;
}

/**
 * 1. Vaccine Reminder Illustration (vaccine_due)
 * Medical Teal / Emerald theme: Shield with pet silhouette, vaccine vial, syringe with glowing drop, calendar badge.
 */
export function VaccineIllustration({ className = "", enabled = true }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 480 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="vax-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#042f2e" />
          <stop offset="50%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#115e59" />
        </linearGradient>
        <radialGradient id="vax-glow" cx="45%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#0f766e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="vax-shield" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="vax-vial-liquid" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
        <linearGradient id="vax-glass" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="480" height="200" fill="url(#vax-bg)" />
      <rect width="480" height="200" fill="url(#vax-glow)" />

      {/* Decorative concentric rings */}
      <circle cx="240" cy="100" r="160" stroke="#2dd4bf" strokeWidth="1" strokeDasharray="4 8" opacity="0.2" />
      <circle cx="240" cy="100" r="110" stroke="#5eead4" strokeWidth="1" strokeDasharray="3 6" opacity="0.3" />
      <circle cx="240" cy="100" r="70" stroke="#99f6e4" strokeWidth="1.5" opacity="0.25" />

      {/* Ambient background particles / medical crosses */}
      <g opacity="0.35">
        <path d="M50 45 h14 v-14 h6 v14 h14 v6 h-14 v14 h-6 v-14 h-14 z" fill="#5eead4" transform="scale(0.5)" />
        <path d="M840 70 h14 v-14 h6 v14 h14 v6 h-14 v14 h-6 v-14 h-14 z" fill="#2dd4bf" transform="scale(0.45)" />
        <path d="M120 320 h14 v-14 h6 v14 h14 v6 h-14 v14 h-6 v-14 h-14 z" fill="#99f6e4" transform="scale(0.4)" />
        <circle cx="430" cy="40" r="3" fill="#5eead4" />
        <circle cx="70" cy="150" r="2.5" fill="#2dd4bf" />
        <circle cx="410" cy="160" r="2" fill="#99f6e4" />
      </g>

      {/* Central Protective Shield */}
      <g transform="translate(240, 95)">
        <path
          d="M0 -65 C38 -65 65 -45 65 -15 C65 35 25 65 0 80 C-25 65 -65 35 -65 -15 C-65 -45 -38 -65 0 -65 Z"
          fill="url(#vax-shield)"
          stroke="#5eead4"
          strokeWidth="2"
        />
        {/* Shield Inner Rim */}
        <path
          d="M0 -56 C30 -56 52 -40 52 -15 C52 28 20 54 0 68 C-20 54 -52 28 -52 -15 C-52 -40 -30 -56 0 -56 Z"
          fill="none"
          stroke="#2dd4bf"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.6"
        />

        {/* Pet silhouette inside shield: Dog & Cat heads */}
        <g fill="#f0fdfa" opacity="0.92">
          {/* Dog profile */}
          <path d="M-18 20 C-26 18 -32 8 -30 -4 C-28 -14 -20 -20 -15 -18 C-10 -16 -6 -8 -7 0 C-4 -6 6 -8 10 -4 C16 1 18 12 14 20 Z" />
          {/* Cat ears & head silhouette */}
          <path d="M4 18 C3 12 8 6 14 6 C17 -1 21 -1 23 4 C27 4 30 10 28 18 Z" opacity="0.85" />
          {/* Medical cross on shield */}
          <path d="M-4 -36 h8 v-8 h6 v8 h8 v6 h-8 v8 h-6 v-8 h-8 z" fill="#2dd4bf" />
        </g>
      </g>

      {/* Left Element: Vaccine Vial */}
      <g transform="translate(130, 98)">
        {/* Shadow */}
        <ellipse cx="0" cy="56" rx="24" ry="7" fill="#021a19" opacity="0.5" />
        {/* Vial Glass Body */}
        <rect x="-20" y="-28" width="40" height="74" rx="8" fill="url(#vax-glass)" stroke="#5eead4" strokeWidth="1.5" />
        {/* Liquid level inside vial */}
        <rect x="-17" y="5" width="34" height="38" rx="5" fill="url(#vax-vial-liquid)" opacity="0.85" />
        {/* Vial neck & aluminum cap */}
        <rect x="-12" y="-38" width="24" height="10" rx="2" fill="#0d9488" stroke="#5eead4" strokeWidth="1" />
        <rect x="-15" y="-45" width="30" height="8" rx="3" fill="#2dd4bf" />
        <circle cx="0" cy="-41" r="2.5" fill="#042f2e" />
        {/* Vial Label */}
        <rect x="-18" y="-12" width="36" height="24" rx="3" fill="#f0fdfa" opacity="0.95" />
        {/* Label cross */}
        <path d="M-3 -4 h6 v-4 h4 v4 h6 v4 h-6 v4 h-4 v-4 h-6 z" fill="#0d9488" transform="scale(0.6)" />
        {/* Liquid shine */}
        <path d="M-15 10 L-15 38" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      </g>

      {/* Right Element: Precision Syringe */}
      <g transform="translate(345, 95) rotate(-28)">
        {/* Shadow */}
        <ellipse cx="-5" cy="50" rx="30" ry="7" fill="#021a19" opacity="0.4" />
        {/* Syringe Barrel */}
        <rect x="-14" y="-35" width="28" height="75" rx="5" fill="url(#vax-glass)" stroke="#5eead4" strokeWidth="1.5" />
        {/* Liquid inside syringe */}
        <rect x="-11" y="-5" width="22" height="42" rx="3" fill="url(#vax-vial-liquid)" opacity="0.8" />
        {/* Ticks on barrel */}
        <line x1="-11" y1="5" x2="-3" y2="5" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />
        <line x1="-11" y1="15" x2="-5" y2="15" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />
        <line x1="-11" y1="25" x2="-3" y2="25" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />
        <line x1="-11" y1="35" x2="-5" y2="35" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />
        {/* Plunger */}
        <rect x="-6" y="-60" width="12" height="30" fill="#2dd4bf" rx="2" />
        <rect x="-16" y="-63" width="32" height="6" rx="3" fill="#5eead4" />
        {/* Stopper */}
        <rect x="-12" y="-8" width="24" height="6" rx="2" fill="#042f2e" />
        {/* Needle Hub & Needle */}
        <path d="M-6 40 L-2 48 L2 48 L6 40 Z" fill="#0d9488" stroke="#5eead4" strokeWidth="1" />
        <line x1="0" y1="48" x2="0" y2="78" stroke="#f0fdfa" strokeWidth="1.5" strokeLinecap="round" />
        {/* Glowing drop at needle tip */}
        <circle cx="0" cy="81" r="3.5" fill="#2dd4bf" />
        <circle cx="0" cy="81" r="6" stroke="#5eead4" strokeWidth="1" opacity="0.7" />
      </g>

      {/* Floating Badge: "14 DNI" */}
      <g transform="translate(70, 42)">
        <rect x="0" y="0" width="84" height="26" rx="13" fill="#042f2e" stroke="#2dd4bf" strokeWidth="1.2" />
        <circle cx="14" cy="13" r="4" fill="#10b981" />
        <text x="26" y="17" fill="#ccfbf1" fontSize="11" fontWeight="700" fontFamily="sans-serif">
          14 DNÍ
        </text>
      </g>

      {/* Floating Protection Sparkle */}
      <g transform="translate(390, 40)">
        <path d="M0 -10 C1 -3 3 -1 10 0 C3 1 1 3 0 10 C-1 3 -3 1 -10 0 C-3 -1 -1 -3 0 -10 Z" fill="#5eead4" />
      </g>
    </svg>
  );
}

/**
 * 2. Post-operative Check-in Illustration (postop_check / surgery_completed)
 * Rose & Coral theme: Resting recovery pet, glowing ECG pulse line, gentle heart with bandage, stethoscope, 24h clock.
 */
export function PostopIllustration({ className = "", enabled = true }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 480 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="postop-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b0764" />
          <stop offset="50%" stopColor="#4c0519" />
          <stop offset="100%" stopColor="#881337" />
        </linearGradient>
        <radialGradient id="postop-glow" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#fb7185" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#4c0519" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="postop-heart" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#be123c" />
        </linearGradient>
        <linearGradient id="postop-steth" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="480" height="200" fill="url(#postop-bg)" />
      <rect width="480" height="200" fill="url(#postop-glow)" />

      {/* Ambient background ECG grid lines */}
      <g stroke="#fda4af" strokeWidth="0.5" opacity="0.15">
        <line x1="0" y1="40" x2="480" y2="40" />
        <line x1="0" y1="80" x2="480" y2="80" />
        <line x1="0" y1="120" x2="480" y2="120" />
        <line x1="0" y1="160" x2="480" y2="160" />
        <line x1="80" y1="0" x2="80" y2="200" />
        <line x1="160" y1="0" x2="160" y2="200" />
        <line x1="240" y1="0" x2="240" y2="200" />
        <line x1="320" y1="0" x2="320" y2="200" />
        <line x1="400" y1="0" x2="400" y2="200" />
      </g>

      {/* Glowing ECG / Pulse Line across bottom */}
      <path
        d="M20 140 L130 140 L145 140 L155 110 L168 165 L180 85 L192 155 L202 135 L215 140 L310 140 L320 120 L330 155 L340 100 L352 145 L360 140 L460 140"
        fill="none"
        stroke="#fda4af"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
      {/* Secondary bright line on peak */}
      <path
        d="M168 165 L180 85 L192 155"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.8"
      />

      {/* Central Composition: Healing Heart with Bandage */}
      <g transform="translate(235, 90)">
        {/* Soft Aura Ring */}
        <circle cx="0" cy="0" r="68" fill="#fda4af" opacity="0.1" />
        <circle cx="0" cy="0" r="54" stroke="#fb7185" strokeWidth="1" strokeDasharray="5 5" opacity="0.35" />

        {/* Big Heart Shape */}
        <path
          d="M0 45 C-45 18 -60 -15 -60 -35 C-60 -55 -40 -65 -20 -65 C-5 -65 0 -50 0 -45 C0 -50 5 -65 20 -65 C40 -65 60 -55 60 -35 C60 18 45 18 0 45 Z"
          fill="url(#postop-heart)"
          stroke="#fecdd3"
          strokeWidth="2"
        />

        {/* Bandage across the heart */}
        <g transform="rotate(32)">
          <rect x="-35" y="-12" width="70" height="24" rx="6" fill="#ffe4e6" stroke="#f43f5e" strokeWidth="1.2" />
          {/* Bandage pad & perforation dots */}
          <rect x="-12" y="-12" width="24" height="24" fill="#fecdd3" />
          <circle cx="-25" cy="0" r="1.5" fill="#fda4af" />
          <circle cx="-20" cy="0" r="1.5" fill="#fda4af" />
          <circle cx="20" cy="0" r="1.5" fill="#fda4af" />
          <circle cx="25" cy="0" r="1.5" fill="#fda4af" />
          {/* Medical cross on bandage */}
          <path d="M-2 -6 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4 v-4 h4 z" fill="#e11d48" />
        </g>

        {/* Peaceful sleeping pet paw touching heart */}
        <g transform="translate(-18, 12)" fill="#ffffff" opacity="0.9">
          <circle cx="18" cy="8" r="7" />
          <circle cx="7" cy="0" r="3.5" />
          <circle cx="14" cy="-4" r="3.5" />
          <circle cx="22" cy="-4" r="3.5" />
          <circle cx="29" cy="0" r="3.5" />
        </g>
      </g>

      {/* Left Element: Professional Stethoscope */}
      <g transform="translate(100, 85)">
        <path
          d="M-20 -35 C-20 20 15 45 45 45 C75 45 100 25 100 -2"
          fill="none"
          stroke="url(#postop-steth)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Chest piece */}
        <circle cx="102" cy="-2" r="14" fill="#334155" stroke="#f1f5f9" strokeWidth="2.5" />
        <circle cx="102" cy="-2" r="8" fill="#e2e8f0" />
        {/* Earpieces */}
        <path d="M-20 -35 C-20 -55 -10 -60 0 -60" fill="none" stroke="#cbd5e1" strokeWidth="3" />
        <path d="M-20 -35 C-20 -55 -30 -60 -40 -60" fill="none" stroke="#cbd5e1" strokeWidth="3" />
        <circle cx="0" cy="-60" r="3" fill="#be123c" />
        <circle cx="-40" cy="-60" r="3" fill="#be123c" />
      </g>

      {/* Floating Badge: "24 HODÍN" */}
      <g transform="translate(365, 42)">
        <rect x="0" y="0" width="88" height="26" rx="13" fill="#4c0519" stroke="#fb7185" strokeWidth="1.2" />
        {/* Clock icon */}
        <circle cx="14" cy="13" r="6" stroke="#fecdd3" strokeWidth="1.2" fill="none" />
        <polyline points="14,10 14,13 17,14" stroke="#fecdd3" strokeWidth="1.2" strokeLinecap="round" />
        <text x="26" y="17" fill="#ffe4e6" fontSize="11" fontWeight="700" fontFamily="sans-serif">
          24 HOD
        </text>
      </g>

      {/* Sparkles of recovery */}
      <g transform="translate(370, 115)">
        <path d="M0 -8 C1 -2 2 -1 8 0 C2 1 1 2 0 8 C-1 2 -2 1 -8 0 C-2 -1 -1 -2 0 -8 Z" fill="#fda4af" />
      </g>
    </svg>
  );
}

/**
 * 3. Google / Review Request Illustration (review_request / visit_completed)
 * Amber & Gold theme: 5 glowing 3D stars, smiling pet mascot with heart bubble, Google review badge, celebration sparkles.
 */
export function ReviewRequestIllustration({ className = "", enabled = true }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 480 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="rev-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#451a03" />
          <stop offset="50%" stopColor="#78350f" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <radialGradient id="rev-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#78350f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rev-star" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="rev-card" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="480" height="200" fill="url(#rev-bg)" />
      <rect width="480" height="200" fill="url(#rev-glow)" />

      {/* Decorative sunburst rays */}
      <g stroke="#fbbf24" strokeWidth="1" strokeDasharray="3 7" opacity="0.25">
        <line x1="240" y1="100" x2="120" y2="20" />
        <line x1="240" y1="100" x2="360" y2="20" />
        <line x1="240" y1="100" x2="80" y2="100" />
        <line x1="240" y1="100" x2="400" y2="100" />
        <line x1="240" y1="100" x2="140" y2="170" />
        <line x1="240" y1="100" x2="340" y2="170" />
      </g>

      {/* Central Review Card Platform */}
      <g transform="translate(140, 48)">
        <rect
          x="0"
          y="0"
          width="200"
          height="104"
          rx="18"
          fill="url(#rev-card)"
          stroke="#fbbf24"
          strokeWidth="1.5"
        />

        {/* 5 Golden Glowing Stars */}
        <g transform="translate(18, 22)">
          {/* Helper macro: star path */}
          {[0, 34, 68, 102, 136].map((offset, idx) => (
            <g key={idx} transform={`translate(${offset}, 0)`}>
              {/* Star glow shadow */}
              <circle cx="15" cy="14" r="14" fill="#fbbf24" opacity="0.3" />
              {/* Crisp 5-point star */}
              <polygon
                points="15,2 19,10 28,11 21,17 23,26 15,21 7,26 9,17 2,11 11,10"
                fill="url(#rev-star)"
                stroke="#fff"
                strokeWidth="1"
              />
            </g>
          ))}
        </g>

        {/* Badge inside card: "5.0 ★ EXCELLENT" */}
        <rect x="35" y="62" width="130" height="28" rx="14" fill="#451a03" stroke="#fcd34d" strokeWidth="1" />
        <text x="100" y="80" fill="#fef08a" fontSize="12" fontWeight="800" fontFamily="sans-serif" textAnchor="middle">
          5.0 ★★★★★
        </text>
      </g>

      {/* Left Character: Happy Golden Dog Mascot */}
      <g transform="translate(68, 105)">
        {/* Soft shadow */}
        <ellipse cx="0" cy="45" rx="35" ry="8" fill="#1c0b02" opacity="0.5" />
        {/* Dog chest/body */}
        <path d="M-30 45 C-28 20 -15 5 0 5 C15 5 28 20 30 45 Z" fill="#f59e0b" />
        {/* Dog head */}
        <circle cx="0" cy="-5" r="24" fill="#fbbf24" />
        {/* Floppy ears */}
        <path d="M-22 -15 C-32 -10 -35 10 -25 15 C-20 18 -18 0 -20 -15 Z" fill="#d97706" />
        <path d="M22 -15 C32 -10 35 10 25 15 C20 18 18 0 20 -15 Z" fill="#d97706" />
        {/* Snout */}
        <ellipse cx="0" cy="2" rx="11" ry="8" fill="#fef3c7" />
        <ellipse cx="0" cy="-2" rx="5" ry="3.5" fill="#451a03" />
        {/* Happy eyes */}
        <path d="M-10 -10 Q-6 -14 -2 -10" stroke="#451a03" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M2 -10 Q6 -14 10 -10" stroke="#451a03" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Happy smile & tongue */}
        <path d="M-5 4 Q0 9 5 4" stroke="#451a03" strokeWidth="2" fill="none" />
        <path d="M-2 6 Q0 12 2 6 Z" fill="#f43f5e" />
      </g>

      {/* Right Element: Smartphone with Thumbs-up / Google G */}
      <g transform="translate(385, 95) rotate(12)">
        {/* Phone frame */}
        <rect x="-24" y="-45" width="48" height="90" rx="10" fill="#1e293b" stroke="#fcd34d" strokeWidth="1.5" />
        {/* Screen */}
        <rect x="-20" y="-38" width="40" height="74" rx="6" fill="#f8fafc" />
        {/* Thumbs-up icon on screen */}
        <g transform="translate(0, -2)" fill="#f59e0b">
          <circle cx="0" cy="0" r="14" fill="#fef3c7" />
          <path d="M-6 4 h3 v-7 h-3 z M-1 4 h6 c2 0 3 -1 3 -3 l-1 -5 c0 -1 -1 -2 -2 -2 h-4 l1 -4 c0 -2 -1 -3 -3 -3 l-2 5 v9 z" fill="#f59e0b" transform="scale(0.8) translate(-2, -2)" />
        </g>
        {/* Heart bubble popping from phone */}
        <g transform="translate(20, -38)">
          <circle cx="0" cy="0" r="12" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
          <path d="M0 4 C-4 1 -6 -2 -6 -4 C-6 -6 -4 -7 -2 -7 C-1 -7 0 -6 0 -5 C0 -6 1 -7 2 -7 C4 -7 6 -6 6 -4 C6 -2 4 1 0 4 Z" fill="#fff" />
        </g>
      </g>

      {/* Floating Celebration Sparkles */}
      <g transform="translate(380, 25)">
        <polygon points="0,-9 2,-2 9,0 2,2 0,9 -2,2 -9,0 -2,-2" fill="#fde047" />
      </g>
      <g transform="translate(100, 30)">
        <polygon points="0,-7 2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2" fill="#fbbf24" />
      </g>
    </svg>
  );
}

/**
 * 4. Inactive Recall Illustration (inactive_recall / annual_checkup_due)
 * Indigo & Cobalt theme: 12-month calendar, ringing bell with reminder waves, welcoming paw trail back to clinic.
 */
export function InactiveRecallIllustration({ className = "", enabled = true }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 480 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="rec-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="50%" stopColor="#312e81" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        <radialGradient id="rec-glow" cx="45%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rec-cal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="rec-bell" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="480" height="200" fill="url(#rec-bg)" />
      <rect width="480" height="200" fill="url(#rec-glow)" />

      {/* Subtle compass rings / time radar */}
      <circle cx="240" cy="100" r="140" stroke="#818cf8" strokeWidth="1" strokeDasharray="4 8" opacity="0.25" />
      <circle cx="240" cy="100" r="95" stroke="#a5b4fc" strokeWidth="1.2" strokeDasharray="3 6" opacity="0.3" />

      {/* Welcoming Paw Trail returning home */}
      <g fill="#c7d2fe" opacity="0.5">
        <g transform="translate(60, 150) scale(0.65) rotate(35)">
          <ellipse cx="0" cy="0" rx="8" ry="6" />
          <circle cx="-7" cy="-9" r="2.8" />
          <circle cx="-1" cy="-12" r="2.8" />
          <circle cx="6" cy="-10" r="2.8" />
          <circle cx="11" cy="-4" r="2.8" />
        </g>
        <g transform="translate(105, 125) scale(0.75) rotate(30)">
          <ellipse cx="0" cy="0" rx="8" ry="6" />
          <circle cx="-7" cy="-9" r="2.8" />
          <circle cx="-1" cy="-12" r="2.8" />
          <circle cx="6" cy="-10" r="2.8" />
          <circle cx="11" cy="-4" r="2.8" />
        </g>
        <g transform="translate(155, 105) scale(0.85) rotate(20)">
          <ellipse cx="0" cy="0" rx="8" ry="6" />
          <circle cx="-7" cy="-9" r="2.8" />
          <circle cx="-1" cy="-12" r="2.8" />
          <circle cx="6" cy="-10" r="2.8" />
          <circle cx="11" cy="-4" r="2.8" />
        </g>
      </g>

      {/* Central 12-Month Calendar */}
      <g transform="translate(230, 95)">
        {/* Shadow */}
        <rect x="-48" y="-45" width="96" height="100" rx="14" fill="#0f172a" opacity="0.4" />
        {/* Calendar sheet */}
        <rect x="-45" y="-48" width="90" height="96" rx="12" fill="url(#rec-cal)" stroke="#c7d2fe" strokeWidth="1.5" />
        {/* Calendar top header (Indigo) */}
        <path d="M-45 -36 C-45 -44 -41 -48 -33 -48 L33 -48 C41 -48 45 -44 45 -36 L45 -22 L-45 -22 Z" fill="#4f46e5" />
        {/* Spiral binder rings */}
        <circle cx="-25" cy="-48" r="3" fill="#e2e8f0" stroke="#312e81" strokeWidth="1.5" />
        <circle cx="0" cy="-48" r="3" fill="#e2e8f0" stroke="#312e81" strokeWidth="1.5" />
        <circle cx="25" cy="-48" r="3" fill="#e2e8f0" stroke="#312e81" strokeWidth="1.5" />
        {/* Big "12M" on calendar page */}
        <text x="0" y="14" fill="#1e1b4b" fontSize="28" fontWeight="900" fontFamily="sans-serif" textAnchor="middle">
          12M
        </text>
        <text x="0" y="32" fill="#6366f1" fontSize="9" fontWeight="700" fontFamily="sans-serif" textAnchor="middle" letterSpacing="1">
          PREVENCIA
        </text>
      </g>

      {/* Right Element: Ringing Notification Bell with Soundwaves */}
      <g transform="translate(365, 92) rotate(15)">
        {/* Bell Body */}
        <path
          d="M0 -30 C-15 -30 -22 -15 -22 10 C-22 18 -28 20 -28 25 L28 25 C28 20 22 18 22 10 C22 -15 15 -30 0 -30 Z"
          fill="url(#rec-bell)"
          stroke="#e0e7ff"
          strokeWidth="1.8"
        />
        {/* Bell top loop */}
        <circle cx="0" cy="-35" r="5" stroke="#e0e7ff" strokeWidth="2" fill="none" />
        {/* Bell clapper */}
        <circle cx="0" cy="30" r="6" fill="#fbbf24" stroke="#fff" strokeWidth="1" />

        {/* Dynamic soundwaves */}
        <path d="M35 5 A 35 35 0 0 1 35 30" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M45 -5 A 50 50 0 0 1 45 40" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
        <path d="M-35 5 A 35 35 0 0 0 -35 30" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M-45 -5 A 50 50 0 0 0 -45 40" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
      </g>

      {/* Floating Badge: "CHÝBATE NÁM" */}
      <g transform="translate(45, 38)">
        <rect x="0" y="0" width="105" height="26" rx="13" fill="#1e1b4b" stroke="#818cf8" strokeWidth="1.2" />
        <circle cx="14" cy="13" r="4" fill="#38bdf8" />
        <text x="25" y="17" fill="#e0e7ff" fontSize="10" fontWeight="700" fontFamily="sans-serif">
          RECALL VET
        </text>
      </g>

      {/* Floating Heart over clinic route */}
      <g transform="translate(195, 45)">
        <path d="M0 8 C-7 2 -10 -3 -10 -6 C-10 -9 -7 -11 -4 -11 C-2 -11 0 -9 0 -8 C0 -9 2 -11 4 -11 C7 -11 10 -9 10 -6 C10 -3 7 2 0 8 Z" fill="#f43f5e" />
      </g>
    </svg>
  );
}

/**
 * 5. Appointment Reminder Illustration (appointment_reminder / appointment_booked)
 * Electric Blue & Cyan theme: Clock face with confirmed checkmark, ticket pass, notification ping, cute pet silhouette.
 */
export function AppointmentReminderIllustration({ className = "", enabled = true }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 480 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="app-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#082f49" />
          <stop offset="50%" stopColor="#0369a1" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <radialGradient id="app-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#082f49" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="app-clock" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="480" height="200" fill="url(#app-bg)" />
      <rect width="480" height="200" fill="url(#app-glow)" />

      {/* Decorative time ticks grid */}
      <circle cx="240" cy="100" r="85" stroke="#7dd3fc" strokeWidth="1" strokeDasharray="3 6" opacity="0.3" />

      {/* Central Big Clinic Clock */}
      <g transform="translate(240, 95)">
        {/* Shadow */}
        <circle cx="0" cy="5" r="48" fill="#021a2e" opacity="0.35" />
        {/* Clock Body */}
        <circle cx="0" cy="0" r="46" fill="url(#app-clock)" stroke="#38bdf8" strokeWidth="3" />
        {/* Cute dog ears on clock */}
        <path d="M-36 -28 C-48 -45 -30 -55 -24 -38 Z" fill="#0284c7" />
        <path d="M36 -28 C48 -45 30 -55 24 -38 Z" fill="#0284c7" />
        {/* Hour markers */}
        <circle cx="0" cy="-36" r="2.5" fill="#0284c7" />
        <circle cx="36" cy="0" r="2.5" fill="#0284c7" />
        <circle cx="0" cy="36" r="2.5" fill="#0284c7" />
        <circle cx="-36" cy="0" r="2.5" fill="#0284c7" />
        {/* Clock Hands pointing to 10:10 */}
        <line x1="0" y1="0" x2="18" y2="-18" stroke="#0369a1" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="0" y1="0" x2="-14" y2="-14" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="0" cy="0" r="4" fill="#0369a1" />

        {/* Confirmed checkmark green badge on clock */}
        <g transform="translate(32, 28)">
          <circle cx="0" cy="0" r="14" fill="#10b981" stroke="#fff" strokeWidth="2" />
          <path d="M-5 0 L-2 4 L6 -4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>

      {/* Left Element: Appointment Ticket Pass */}
      <g transform="translate(100, 95) rotate(-10)">
        <rect x="-35" y="-45" width="70" height="90" rx="10" fill="#f0f9ff" stroke="#38bdf8" strokeWidth="1.5" />
        {/* Top bar */}
        <path d="M-35 -35 C-35 -42 -30 -45 -25 -45 L25 -45 C30 -45 35 -42 35 -35 L35 -25 L-35 -25 Z" fill="#0ea5e9" />
        {/* Ticket notch cutouts */}
        <circle cx="-35" cy="5" r="7" fill="#082f49" />
        <circle cx="35" cy="5" r="7" fill="#082f49" />
        <line x1="-24" y1="5" x2="24" y2="5" stroke="#bae6fd" strokeWidth="1.5" strokeDasharray="3 3" />
        {/* Ticket content lines */}
        <rect x="-20" y="-12" width="40" height="6" rx="2" fill="#0284c7" opacity="0.6" />
        <rect x="-20" y="16" width="30" height="4" rx="2" fill="#94a3b8" />
        <rect x="-20" y="24" width="22" height="4" rx="2" fill="#94a3b8" />
      </g>

      {/* Right Element: SMS Notification Bubble */}
      <g transform="translate(375, 95)">
        <path
          d="M-40 -25 C-40 -35 -30 -40 -20 -40 L20 -40 C30 -40 40 -35 40 -25 L40 10 C40 20 30 25 20 25 L-10 25 L-25 35 L-22 25 L-30 25 C-38 25 -40 20 -40 10 Z"
          fill="#ffffff"
          stroke="#38bdf8"
          strokeWidth="1.5"
        />
        {/* Message bubble content: SMS text lines + bell */}
        <circle cx="-22" cy="-7" r="7" fill="#e0f2fe" />
        <path d="M-22 -11 C-25 -11 -26 -8 -26 -5 L-18 -5 C-18 -8 -19 -11 -22 -11 Z" fill="#0284c7" />
        <rect x="-10" y="-14" width="36" height="5" rx="2" fill="#0284c7" />
        <rect x="-10" y="-5" width="25" height="4" rx="2" fill="#7dd3fc" />
        <rect x="-10" y="3" width="30" height="4" rx="2" fill="#cbd5e1" />
      </g>

      {/* Floating Badge */}
      <g transform="translate(45, 35)">
        <rect x="0" y="0" width="85" height="24" rx="12" fill="#082f49" stroke="#38bdf8" strokeWidth="1.2" />
        <text x="42" y="16" fill="#e0f2fe" fontSize="10" fontWeight="700" fontFamily="sans-serif" textAnchor="middle">
          SMS VČAS
        </text>
      </g>
    </svg>
  );
}

/**
 * 6. Senior Pet Screening Illustration (senior_screening)
 * Bronze & Warm Amber theme: Loving hands holding senior dog/cat with cute glasses, longevity vitality shield, warm glow.
 */
export function SeniorScreeningIllustration({ className = "", enabled = true }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 480 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="sen-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#431407" />
          <stop offset="50%" stopColor="#7c2d12" />
          <stop offset="100%" stopColor="#9a3412" />
        </linearGradient>
        <radialGradient id="sen-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fdba74" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#431407" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="480" height="200" fill="url(#sen-bg)" />
      <rect width="480" height="200" fill="url(#sen-glow)" />

      {/* Concentric gentle rings */}
      <circle cx="240" cy="100" r="130" stroke="#fdba74" strokeWidth="1" strokeDasharray="4 6" opacity="0.25" />

      {/* Central Senior Dog with cute round glasses */}
      <g transform="translate(240, 95)">
        <circle cx="0" cy="0" r="42" fill="#ea580c" opacity="0.3" />
        {/* Head */}
        <circle cx="0" cy="-6" r="28" fill="#fed7aa" />
        {/* Floppy ears with silver wisdom highlights */}
        <path d="M-26 -16 C-38 -8 -40 16 -28 20 C-22 22 -20 0 -24 -16 Z" fill="#c2410c" />
        <path d="M26 -16 C38 -8 40 16 28 20 C22 22 20 0 24 -16 Z" fill="#c2410c" />
        {/* Silver fur patches */}
        <path d="M-10 -25 C-5 -28 5 -28 10 -25 C5 -22 -5 -22 -10 -25 Z" fill="#ffffff" opacity="0.8" />
        {/* Snout with white muzzle */}
        <ellipse cx="0" cy="2" rx="14" ry="10" fill="#ffffff" />
        <ellipse cx="0" cy="-3" rx="5" ry="3.5" fill="#431407" />
        <path d="M-4 4 Q0 8 4 4" stroke="#431407" strokeWidth="2" fill="none" />
        {/* Cute circular wireframe glasses */}
        <circle cx="-9" cy="-8" r="8" fill="none" stroke="#b45309" strokeWidth="2" />
        <circle cx="9" cy="-8" r="8" fill="none" stroke="#b45309" strokeWidth="2" />
        <line x1="-1" y1="-8" x2="1" y2="-8" stroke="#b45309" strokeWidth="2" />
        {/* Wise kind eyes behind glasses */}
        <circle cx="-9" cy="-8" r="2" fill="#431407" />
        <circle cx="9" cy="-8" r="2" fill="#431407" />
      </g>

      {/* Caring Hands embracing from sides */}
      <g fill="#ffedd5" opacity="0.85">
        {/* Left hand */}
        <path d="M120 135 C140 130 170 120 185 110 C182 125 160 145 130 150 Z" />
        {/* Right hand */}
        <path d="M360 135 C340 130 310 120 295 110 C298 125 320 145 350 150 Z" />
      </g>

      {/* Floating Badge: "SENIOR 7+" */}
      <g transform="translate(365, 42)">
        <rect x="0" y="0" width="85" height="26" rx="13" fill="#431407" stroke="#fdba74" strokeWidth="1.2" />
        <text x="42" y="17" fill="#ffedd5" fontSize="11" fontWeight="700" fontFamily="sans-serif" textAnchor="middle">
          SENIOR 7+
        </text>
      </g>

      {/* Vitality Leaf & Heart */}
      <g transform="translate(70, 50)">
        <path d="M0 -12 C10 -12 18 -4 18 6 C18 16 0 24 0 24 C0 24 -18 16 -18 6 C-18 -4 -10 -12 0 -12 Z" fill="#ea580c" opacity="0.6" />
        <path d="M0 -8 L0 18" stroke="#ffedd5" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

/**
 * 7. Wellness Plan Illustration (wellness_enrolled)
 * Purple & Royal Violet theme: VIP Golden medal / wellness pass card, medical cross, sparkling health stars.
 */
export function WellnessPlanIllustration({ className = "", enabled = true }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 480 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="wel-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2e1065" />
          <stop offset="50%" stopColor="#581c87" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
        <radialGradient id="wel-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c084fc" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#2e1065" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="480" height="200" fill="url(#wel-bg)" />
      <rect width="480" height="200" fill="url(#wel-glow)" />

      {/* Central Wellness Pass Card */}
      <g transform="translate(240, 95)">
        <rect x="-85" y="-48" width="170" height="96" rx="14" fill="#3b0764" stroke="#c084fc" strokeWidth="2" />
        {/* Golden ribbon header */}
        <path d="M-85 -36 C-85 -44 -79 -48 -71 -48 L71 -48 C79 -48 85 -44 85 -36 L85 -20 L-85 -20 Z" fill="#d97706" />
        <text x="0" y="-28" fill="#fef3c7" fontSize="10" fontWeight="800" fontFamily="sans-serif" textAnchor="middle" letterSpacing="1">
          WELLNESS VIP PASS
        </text>
        {/* Golden Paw Crest */}
        <g transform="translate(0, 14)" fill="#f59e0b">
          <ellipse cx="0" cy="6" rx="14" ry="10" />
          <circle cx="-12" cy="-8" r="4.5" />
          <circle cx="-4" cy="-14" r="4.5" />
          <circle cx="4" cy="-14" r="4.5" />
          <circle cx="12" cy="-8" r="4.5" />
        </g>
      </g>

      {/* Floating Sparkles & Laurel */}
      <g transform="translate(80, 75)">
        <polygon points="0,-10 3,-3 10,0 3,3 0,10 -3,3 -10,0 -3,-3" fill="#fcd34d" />
      </g>
      <g transform="translate(400, 75)">
        <polygon points="0,-10 3,-3 10,0 3,3 0,10 -3,3 -10,0 -3,-3" fill="#fcd34d" />
      </g>
    </svg>
  );
}

/**
 * 8. Appointment No-Show Follow Up Illustration (appointment_no_show)
 * Tangerine & Peach theme: Calendar with circular refresh/reschedule arrows, warm notification badge.
 */
export function AppointmentNoShowIllustration({ className = "", enabled = true }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 480 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="ns-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#431407" />
          <stop offset="50%" stopColor="#9a3412" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <radialGradient id="ns-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#431407" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="480" height="200" fill="url(#ns-bg)" />
      <rect width="480" height="200" fill="url(#ns-glow)" />

      {/* Central Re-schedule Loop */}
      <g transform="translate(240, 95)">
        <circle cx="0" cy="0" r="50" fill="#7c2d12" stroke="#fed7aa" strokeWidth="2" strokeDasharray="6 6" />
        {/* Calendar icon */}
        <rect x="-24" y="-22" width="48" height="46" rx="8" fill="#ffffff" />
        <rect x="-24" y="-22" width="48" height="14" fill="#c2410c" rx="4" />
        <text x="0" y="14" fill="#9a3412" fontSize="16" fontWeight="900" fontFamily="sans-serif" textAnchor="middle">
          ?
        </text>

        {/* Reschedule Circular Arrows */}
        <path
          d="M-55 0 A 55 55 0 0 1 0 -55"
          fill="none"
          stroke="#fde047"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M55 0 A 55 55 0 0 1 0 55"
          fill="none"
          stroke="#fde047"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <polygon points="-5,55 5,50 5,60" fill="#fde047" />
        <polygon points="5,-55 -5,-50 -5,-60" fill="#fde047" />
      </g>

      <g transform="translate(45, 40)">
        <rect x="0" y="0" width="105" height="24" rx="12" fill="#431407" stroke="#fdba74" strokeWidth="1.2" />
        <text x="52" y="16" fill="#ffedd5" fontSize="10" fontWeight="700" fontFamily="sans-serif" textAnchor="middle">
          PREOBJEDNANIE
        </text>
      </g>
    </svg>
  );
}

/**
 * 9. Sympathy Gate / Deceased Patient (patient_deceased)
 * Serene Lavender / Soft Slate theme: Warm glowing memorial candle, gentle paw print with quiet angel stardust.
 */
export function PatientDeceasedIllustration({ className = "", enabled = true }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 480 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="dec-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="50%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
      </defs>

      <rect width="480" height="200" fill="url(#dec-bg)" />

      {/* Gentle Memorial Candle in center */}
      <g transform="translate(240, 110)">
        {/* Candle stick */}
        <rect x="-14" y="-30" width="28" height="65" rx="5" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
        {/* Wick */}
        <line x1="0" y1="-30" x2="0" y2="-40" stroke="#475569" strokeWidth="2" />
        {/* Flame Glow */}
        <circle cx="0" cy="-48" r="22" fill="#fbbf24" opacity="0.35" />
        {/* Flame */}
        <path d="M0 -62 C6 -52 8 -44 0 -38 C-8 -44 -6 -52 0 -62 Z" fill="#f59e0b" />
        <path d="M0 -56 C3 -50 4 -46 0 -42 C-4 -46 -3 -50 0 -56 Z" fill="#fef08a" />
      </g>

      {/* Gentle paw silhouette with angel wings aura */}
      <g transform="translate(240, 42)" fill="#e0e7ff" opacity="0.7">
        <circle cx="0" cy="0" r="1.5" />
        <circle cx="-60" cy="20" r="2" />
        <circle cx="60" cy="20" r="2" />
      </g>

      <g transform="translate(45, 40)">
        <rect x="0" y="0" width="105" height="24" rx="12" fill="#0f172a" stroke="#818cf8" strokeWidth="1.2" />
        <text x="52" y="16" fill="#e0e7ff" fontSize="10" fontWeight="700" fontFamily="sans-serif" textAnchor="middle">
          SYMPATHY GATE
        </text>
      </g>
    </svg>
  );
}

/**
 * 10. Default / Custom Smart Automation Flow (fallback)
 * Modern Dark Teal & Slate gradient with automated gears, lightning bolt, connected veterinary nodes.
 */
export function DefaultAutomationIllustration({ className = "", enabled = true }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 480 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="def-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="50%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <radialGradient id="def-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="480" height="200" fill="url(#def-bg)" />
      <rect width="480" height="200" fill="url(#def-glow)" />

      {/* Connected Nodes Flow */}
      <g stroke="#2dd4bf" strokeWidth="2" strokeDasharray="4 6" opacity="0.4">
        <line x1="80" y1="100" x2="240" y2="100" />
        <line x1="240" y1="100" x2="400" y2="100" />
      </g>

      {/* Left Node: Trigger Lightning */}
      <g transform="translate(100, 100)">
        <circle cx="0" cy="0" r="28" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
        <path d="M-4 -12 L4 -12 L0 0 L6 0 L-6 14 L-2 4 L-8 4 Z" fill="#38bdf8" />
      </g>

      {/* Central Node: Automated Engine Gear */}
      <g transform="translate(240, 100)">
        <circle cx="0" cy="0" r="42" fill="#0f766e" stroke="#5eead4" strokeWidth="2.5" />
        {/* Gear teeth */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <rect
            key={angle}
            x="-5"
            y="-48"
            width="10"
            height="10"
            rx="2"
            fill="#5eead4"
            transform={`rotate(${angle})`}
          />
        ))}
        {/* Center cross/paw */}
        <circle cx="0" cy="0" r="20" fill="#042f2e" />
        <path d="M-3 -8 h6 v5 h5 v6 h-5 v5 h-6 v-5 h-5 v-6 h5 z" fill="#2dd4bf" />
      </g>

      {/* Right Node: Outcome Paw / Message */}
      <g transform="translate(380, 100)">
        <circle cx="0" cy="0" r="28" fill="#1e293b" stroke="#2dd4bf" strokeWidth="2" />
        <g fill="#2dd4bf" transform="scale(0.8) translate(-15, -12)">
          <ellipse cx="18" cy="18" rx="8" ry="6" />
          <circle cx="10" cy="9" r="2.8" />
          <circle cx="16" cy="6" r="2.8" />
          <circle cx="23" cy="7" r="2.8" />
          <circle cx="28" cy="13" r="2.8" />
        </g>
      </g>

      <g transform="translate(45, 40)">
        <rect x="0" y="0" width="95" height="24" rx="12" fill="#0f172a" stroke="#2dd4bf" strokeWidth="1.2" />
        <text x="47" y="16" fill="#ccfbf1" fontSize="10" fontWeight="700" fontFamily="sans-serif" textAnchor="middle">
          AUTO FLOW
        </text>
      </g>
    </svg>
  );
}

/**
 * Helper component that maps any automation rule to its corresponding illustration.
 */
export function AutomationIllustration({
  ruleKey,
  triggerKey,
  enabled = true,
  className = "",
}: {
  ruleKey?: string;
  triggerKey?: string;
  enabled?: boolean;
  className?: string;
}) {
  const normKey = (ruleKey || "").toLowerCase();
  const normTrigger = (triggerKey || "").toLowerCase();

  if (
    normKey.includes("vaccin") ||
    normTrigger.includes("vaccin") ||
    normKey.includes("ockov") ||
    normKey.includes("rabies") ||
    normTrigger.includes("rabies")
  ) {
    return <VaccineIllustration className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("postop") ||
    normTrigger.includes("surgery") ||
    normKey.includes("operac") ||
    normKey.includes("surgery")
  ) {
    return <PostopIllustration className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("review") ||
    normTrigger.includes("appointment_completed") ||
    normTrigger.includes("visit_completed") ||
    normTrigger.includes("visit_closeout") ||
    normKey.includes("recenz")
  ) {
    return <ReviewRequestIllustration className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("inactive") ||
    normTrigger.includes("inactive") ||
    normTrigger.includes("annual_checkup") ||
    normKey.includes("neaktiv") ||
    normKey.includes("recall")
  ) {
    return <InactiveRecallIllustration className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("appointment_reminder") ||
    normTrigger.includes("appointment_reminder") ||
    normTrigger.includes("appointment_booked") ||
    normKey.includes("termin")
  ) {
    return <AppointmentReminderIllustration className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("senior") ||
    normTrigger.includes("senior") ||
    normKey.includes("geriat")
  ) {
    return <SeniorScreeningIllustration className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("wellness") ||
    normTrigger.includes("wellness")
  ) {
    return <WellnessPlanIllustration className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("no_show") ||
    normTrigger.includes("no_show")
  ) {
    return <AppointmentNoShowIllustration className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("deceased") ||
    normTrigger.includes("deceased") ||
    normKey.includes("umrt")
  ) {
    return <PatientDeceasedIllustration className={className} enabled={enabled} />;
  }

  return <DefaultAutomationIllustration className={className} enabled={enabled} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLURB ICONS (Compact 64x64 spot illustrations for feature blurb card layout)
// ─────────────────────────────────────────────────────────────────────────────

interface BlurbIconProps {
  className?: string;
  enabled?: boolean;
}

/**
 * 1. Vaccine Reminder Blurb Icon
 * Emerald/Teal squircle: Protective shield, precision syringe with cyan drop, medical cross.
 */
export function VaccineBlurbIcon({ className = "w-14 h-14", enabled = true }: BlurbIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="blurb-vax-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#042f2e" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id="blurb-vax-shield" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Squircle Background */}
      <rect width="64" height="64" rx="16" fill="url(#blurb-vax-bg)" stroke="#2dd4bf" strokeWidth="1.2" />
      <circle cx="32" cy="32" r="24" stroke="#5eead4" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.3" />

      {/* Protective Shield */}
      <path
        d="M32 12 C42 12 49 17 49 26 C49 40 38 48 32 52 C26 48 15 40 15 26 C15 17 22 12 32 12 Z"
        fill="url(#blurb-vax-shield)"
        stroke="#5eead4"
        strokeWidth="1.5"
      />

      {/* White cross inside shield */}
      <path d="M30 20 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4 v-4 h4 z" fill="#ccfbf1" />

      {/* Syringe tilted across */}
      <g transform="translate(35, 27) rotate(-35)">
        {/* Barrel */}
        <rect x="-4" y="-8" width="8" height="18" rx="2" fill="#ffffff" stroke="#2dd4bf" strokeWidth="1" />
        {/* Liquid */}
        <rect x="-3" y="-1" width="6" height="10" rx="1" fill="#14b8a6" />
        {/* Ticks */}
        <line x1="-3" y1="2" x2="-1" y2="2" stroke="#ffffff" strokeWidth="1" />
        <line x1="-3" y1="5" x2="-1" y2="5" stroke="#ffffff" strokeWidth="1" />
        {/* Plunger */}
        <rect x="-2" y="-14" width="4" height="6" fill="#5eead4" />
        <rect x="-5" y="-15" width="10" height="2" rx="1" fill="#99f6e4" />
        {/* Needle */}
        <line x1="0" y1="10" x2="0" y2="18" stroke="#f0fdfa" strokeWidth="1.2" strokeLinecap="round" />
        {/* Glowing Drop */}
        <circle cx="0" cy="20" r="1.5" fill="#2dd4bf" />
      </g>

      {/* Sparkle */}
      <polygon points="48,16 49,19 52,20 49,21 48,24 47,21 44,20 47,19" fill="#99f6e4" />
    </svg>
  );
}

/**
 * 2. Post-operative Check-in Blurb Icon
 * Rose/Coral squircle: Healing heart with cross bandage, glowing pulse wave line.
 */
export function PostopBlurbIcon({ className = "w-14 h-14", enabled = true }: BlurbIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="blurb-post-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4c0519" />
          <stop offset="100%" stopColor="#881337" />
        </linearGradient>
        <linearGradient id="blurb-post-heart" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
      </defs>

      {/* Squircle Background */}
      <rect width="64" height="64" rx="16" fill="url(#blurb-post-bg)" stroke="#fb7185" strokeWidth="1.2" />

      {/* Ambient ECG Pulse Line in background */}
      <path
        d="M8 40 L22 40 L25 34 L29 46 L33 28 L37 44 L40 40 L56 40"
        stroke="#fda4af"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />

      {/* Heart */}
      <path
        d="M32 44 C20 36 14 26 14 20 C14 14 19 11 24 11 C28 11 31 13 32 15 C33 13 36 11 40 11 C45 11 50 14 50 20 C50 26 44 36 32 44 Z"
        fill="url(#blurb-post-heart)"
        stroke="#ffe4e6"
        strokeWidth="1.2"
      />

      {/* Cross Bandage over heart */}
      <g transform="translate(32, 24) rotate(25)">
        <rect x="-12" y="-4" width="24" height="8" rx="2" fill="#fff1f2" stroke="#fb7185" strokeWidth="0.8" />
        <rect x="-4" y="-4" width="8" height="8" fill="#fecdd3" />
        <path d="M-1 -2 h2 v2 h2 v2 h-2 v2 h-2 v-2 h-2 v-2 h2 z" fill="#e11d48" />
      </g>

      {/* Healing sparkles */}
      <polygon points="16,16 17,18 19,19 17,20 16,22 15,20 13,19 15,18" fill="#fecdd3" />
      <polygon points="48,38 49,40 51,41 49,42 48,44 47,42 45,41 47,40" fill="#fecdd3" />
    </svg>
  );
}

/**
 * 3. Review Request Blurb Icon
 * Amber/Gold squircle: 3D glowing star, speech bubble with smile/heart.
 */
export function ReviewBlurbIcon({ className = "w-14 h-14", enabled = true }: BlurbIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="blurb-rev-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#451a03" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <linearGradient id="blurb-rev-star" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* Squircle Background */}
      <rect width="64" height="64" rx="16" fill="url(#blurb-rev-bg)" stroke="#f59e0b" strokeWidth="1.2" />

      {/* Speech Chat Bubble */}
      <path
        d="M16 18 C16 14 20 12 26 12 L38 12 C44 12 48 14 48 18 L48 34 C48 38 44 40 38 40 L26 40 L19 46 L20 40 L19 40 C16 40 16 38 16 34 Z"
        fill="#ffffff"
        opacity="0.15"
      />

      {/* Big Golden 5-point Star */}
      <polygon
        points="32,15 36,25 47,26 38,33 41,44 32,38 23,44 26,33 17,26 28,25"
        fill="url(#blurb-rev-star)"
        stroke="#ffffff"
        strokeWidth="1.2"
      />

      {/* Mini Companion Stars */}
      <polygon points="16,16 17,19 20,20 17,21 16,24 15,21 12,20 15,19" fill="#fde047" />
      <polygon points="48,16 49,19 52,20 49,21 48,24 47,21 44,20 47,19" fill="#fde047" />

      {/* Happy Paw / Smile underneath */}
      <g transform="translate(32, 50)" fill="#fef08a">
        <circle cx="0" cy="0" r="3" />
        <circle cx="-5" cy="-4" r="1.5" />
        <circle cx="-2" cy="-6" r="1.5" />
        <circle cx="2" cy="-6" r="1.5" />
        <circle cx="5" cy="-4" r="1.5" />
      </g>
    </svg>
  );
}

/**
 * 4. Inactive Recall Blurb Icon
 * Indigo/Sky squircle: Calendar with "12M" and ringing bell with acoustic waves.
 */
export function RecallBlurbIcon({ className = "w-14 h-14", enabled = true }: BlurbIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="blurb-rec-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
      </defs>

      {/* Squircle Background */}
      <rect width="64" height="64" rx="16" fill="url(#blurb-rec-bg)" stroke="#818cf8" strokeWidth="1.2" />

      {/* Calendar Card */}
      <rect x="15" y="16" width="30" height="34" rx="6" fill="#f8fafc" stroke="#c7d2fe" strokeWidth="1.2" />
      <path d="M15 22 C15 18 17 16 21 16 L39 16 C43 16 45 18 45 22 L45 25 L15 25 Z" fill="#4f46e5" />
      <circle cx="22" cy="16" r="1.5" fill="#e2e8f0" />
      <circle cx="38" cy="16" r="1.5" fill="#e2e8f0" />
      <text x="30" y="39" fill="#1e1b4b" fontSize="11" fontWeight="900" fontFamily="sans-serif" textAnchor="middle">
        12M
      </text>

      {/* Ringing Notification Bell with waves overlapping */}
      <g transform="translate(42, 38) rotate(14)">
        <path
          d="M0 -12 C-6 -12 -9 -6 -9 4 C-9 7 -12 8 -12 10 L12 10 C12 8 9 7 9 4 C9 -6 6 -12 0 -12 Z"
          fill="#38bdf8"
          stroke="#e0e7ff"
          strokeWidth="1.2"
        />
        <circle cx="0" cy="12" r="2.5" fill="#fbbf24" />
        {/* Soundwaves */}
        <path d="M14 2 A 14 14 0 0 1 14 12" stroke="#a5b4fc" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

/**
 * 5. Appointment Reminder Blurb Icon
 * Cyan/Blue squircle: Clinic clock with cute pet ears and confirmed green checkmark badge.
 */
export function AppointmentBlurbIcon({ className = "w-14 h-14", enabled = true }: BlurbIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="blurb-app-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#082f49" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>

      {/* Squircle Background */}
      <rect width="64" height="64" rx="16" fill="url(#blurb-app-bg)" stroke="#38bdf8" strokeWidth="1.2" />

      {/* Clock body */}
      <circle cx="32" cy="34" r="19" fill="#ffffff" stroke="#38bdf8" strokeWidth="2" />
      {/* Dog ears on clock */}
      <path d="M18 20 C12 12 21 7 24 16 Z" fill="#0284c7" />
      <path d="M46 20 C52 12 43 7 40 16 Z" fill="#0284c7" />

      {/* Hour ticks */}
      <circle cx="32" cy="19" r="1.2" fill="#0369a1" />
      <circle cx="47" cy="34" r="1.2" fill="#0369a1" />
      <circle cx="32" cy="49" r="1.2" fill="#0369a1" />
      <circle cx="17" cy="34" r="1.2" fill="#0369a1" />

      {/* Clock Hands pointing to 10:10 */}
      <line x1="32" y1="34" x2="40" y2="26" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="34" x2="25" y2="27" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="32" cy="34" r="2" fill="#0369a1" />

      {/* Verified checkmark badge in corner */}
      <circle cx="46" cy="46" r="7" fill="#10b981" stroke="#ffffff" strokeWidth="1.2" />
      <path d="M43 46 L45 48 L49 44" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * 6. Senior Screening Blurb Icon
 * Bronze squircle: Senior pet with glasses, vitality heart and caring hands.
 */
export function SeniorBlurbIcon({ className = "w-14 h-14", enabled = true }: BlurbIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="blurb-sen-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#431407" />
          <stop offset="100%" stopColor="#9a3412" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="16" fill="url(#blurb-sen-bg)" stroke="#fdba74" strokeWidth="1.2" />

      {/* Senior Dog Head */}
      <circle cx="32" cy="30" r="16" fill="#fed7aa" />
      <path d="M17 24 C10 28 9 40 16 42 Z" fill="#c2410c" />
      <path d="M47 24 C54 28 55 40 48 42 Z" fill="#c2410c" />
      {/* White snout */}
      <ellipse cx="32" cy="35" rx="8" ry="6" fill="#ffffff" />
      <ellipse cx="32" cy="32" rx="3" ry="2" fill="#431407" />
      {/* Glasses */}
      <circle cx="27" cy="27" r="4.5" fill="none" stroke="#b45309" strokeWidth="1.5" />
      <circle cx="37" cy="27" r="4.5" fill="none" stroke="#b45309" strokeWidth="1.5" />
      <line x1="31.5" y1="27" x2="32.5" y2="27" stroke="#b45309" strokeWidth="1.5" />

      {/* Vitality badge */}
      <circle cx="48" cy="18" r="6" fill="#ea580c" stroke="#fed7aa" strokeWidth="1" />
      <text x="48" y="21" fill="#fff" fontSize="7" fontWeight="900" fontFamily="sans-serif" textAnchor="middle">
        7+
      </text>
    </svg>
  );
}

/**
 * 7. Wellness Plan Blurb Icon
 * Violet squircle: Golden VIP medal ribbon with paw seal.
 */
export function WellnessBlurbIcon({ className = "w-14 h-14", enabled = true }: BlurbIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="blurb-wel-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2e1065" />
          <stop offset="100%" stopColor="#581c87" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="16" fill="url(#blurb-wel-bg)" stroke="#c084fc" strokeWidth="1.2" />

      {/* VIP Ribbon tails */}
      <path d="M26 42 L22 56 L32 50 L42 56 L38 42 Z" fill="#d97706" />

      {/* Golden Medal Circle */}
      <circle cx="32" cy="28" r="16" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.5" />
      <circle cx="32" cy="28" r="13" fill="#fbbf24" />

      {/* Paw inside medal */}
      <g transform="translate(32, 28)" fill="#78350f">
        <ellipse cx="0" cy="2" rx="4.5" ry="3.5" />
        <circle cx="-3.5" cy="-3" r="1.5" />
        <circle cx="-1.2" cy="-5" r="1.5" />
        <circle cx="1.2" cy="-5" r="1.5" />
        <circle cx="3.5" cy="-3" r="1.5" />
      </g>

      {/* Sparkles */}
      <polygon points="16,14 17,16 19,17 17,18 16,20 15,18 13,17 15,16" fill="#fef08a" />
      <polygon points="48,14 49,16 51,17 49,18 48,20 47,18 45,17 47,16" fill="#fef08a" />
    </svg>
  );
}

/**
 * 8. Appointment No-Show Blurb Icon
 * Tangerine squircle: Calendar with reschedule loop arrows.
 */
export function NoShowBlurbIcon({ className = "w-14 h-14", enabled = true }: BlurbIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="blurb-ns-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#431407" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="16" fill="url(#blurb-ns-bg)" stroke="#fdba74" strokeWidth="1.2" />

      {/* Calendar */}
      <rect x="18" y="18" width="28" height="28" rx="6" fill="#ffffff" stroke="#fdba74" strokeWidth="1.2" />
      <rect x="18" y="18" width="28" height="8" rx="4" fill="#c2410c" />
      <text x="32" y="38" fill="#9a3412" fontSize="14" fontWeight="900" fontFamily="sans-serif" textAnchor="middle">
        ?
      </text>

      {/* Refresh loop arrow */}
      <path
        d="M48 24 A 18 18 0 1 1 20 46"
        fill="none"
        stroke="#fde047"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <polygon points="50,22 44,25 47,29" fill="#fde047" />
    </svg>
  );
}

/**
 * 9. Sympathy Gate / Deceased Blurb Icon
 * Slate/Lavender squircle: Glowing memorial candle with warm flame and quiet angel paw.
 */
export function DeceasedBlurbIcon({ className = "w-14 h-14", enabled = true }: BlurbIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="blurb-dec-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="16" fill="url(#blurb-dec-bg)" stroke="#818cf8" strokeWidth="1.2" />

      {/* Candle */}
      <rect x="27" y="30" width="10" height="22" rx="3" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
      <line x1="32" y1="30" x2="32" y2="25" stroke="#475569" strokeWidth="1.5" />
      {/* Flame Glow */}
      <circle cx="32" cy="20" r="8" fill="#fbbf24" opacity="0.35" />
      <path d="M32 14 C35 18 36 21 32 24 C28 21 29 18 32 14 Z" fill="#f59e0b" />
      <path d="M32 17 C34 19 34 20 32 22 C30 20 30 19 32 17 Z" fill="#fef08a" />

      {/* Angel halo stardust */}
      <circle cx="32" cy="8" r="1" fill="#e0e7ff" />
      <circle cx="20" cy="16" r="1" fill="#e0e7ff" />
      <circle cx="44" cy="16" r="1" fill="#e0e7ff" />
    </svg>
  );
}

/**
 * 10. Default / Custom Flow Blurb Icon
 * Slate/Teal squircle: Automation gears with lightning trigger and connected paw node.
 */
export function DefaultBlurbIcon({ className = "w-14 h-14", enabled = true }: BlurbIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${!enabled ? "grayscale-[60%] opacity-70" : ""}`}
    >
      <defs>
        <linearGradient id="blurb-def-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="16" fill="url(#blurb-def-bg)" stroke="#2dd4bf" strokeWidth="1.2" />

      {/* Automation Gear */}
      <circle cx="32" cy="32" r="14" fill="#0f766e" stroke="#5eead4" strokeWidth="1.5" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <rect
          key={angle}
          x="30"
          y="14"
          width="4"
          height="5"
          rx="1"
          fill="#5eead4"
          transform={`rotate(${angle} 32 32)`}
        />
      ))}
      <circle cx="32" cy="32" r="7" fill="#042f2e" />

      {/* Lightning trigger inside */}
      <path d="M31 27 L34 27 L32 31 L35 31 L29 37 L31 33 L28 33 Z" fill="#38bdf8" />
    </svg>
  );
}

/**
 * Helper component that maps any automation rule to its corresponding Blurb Icon.
 */
export function AutomationBlurbIcon({
  ruleKey,
  triggerKey,
  enabled = true,
  className = "w-14 h-14",
}: {
  ruleKey?: string;
  triggerKey?: string;
  enabled?: boolean;
  className?: string;
}) {
  const normKey = (ruleKey || "").toLowerCase();
  const normTrigger = (triggerKey || "").toLowerCase();

  if (
    normKey.includes("vaccin") ||
    normTrigger.includes("vaccin") ||
    normKey.includes("ockov") ||
    normKey.includes("rabies") ||
    normTrigger.includes("rabies")
  ) {
    return <VaccineBlurbIcon className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("postop") ||
    normTrigger.includes("surgery") ||
    normKey.includes("operac") ||
    normKey.includes("surgery")
  ) {
    return <PostopBlurbIcon className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("review") ||
    normTrigger.includes("appointment_completed") ||
    normTrigger.includes("visit_completed") ||
    normTrigger.includes("visit_closeout") ||
    normKey.includes("recenz")
  ) {
    return <ReviewBlurbIcon className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("inactive") ||
    normTrigger.includes("inactive") ||
    normTrigger.includes("annual_checkup") ||
    normKey.includes("neaktiv") ||
    normKey.includes("recall")
  ) {
    return <RecallBlurbIcon className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("appointment_reminder") ||
    normTrigger.includes("appointment_reminder") ||
    normTrigger.includes("appointment_booked") ||
    normKey.includes("termin")
  ) {
    return <AppointmentBlurbIcon className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("senior") ||
    normTrigger.includes("senior") ||
    normKey.includes("geriat")
  ) {
    return <SeniorBlurbIcon className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("wellness") ||
    normTrigger.includes("wellness")
  ) {
    return <WellnessBlurbIcon className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("no_show") ||
    normTrigger.includes("no_show")
  ) {
    return <NoShowBlurbIcon className={className} enabled={enabled} />;
  }

  if (
    normKey.includes("deceased") ||
    normTrigger.includes("deceased") ||
    normKey.includes("umrt")
  ) {
    return <DeceasedBlurbIcon className={className} enabled={enabled} />;
  }

  return <DefaultBlurbIcon className={className} enabled={enabled} />;
}

