// src/utils/statusHelpers.ts
// Configuration centralisée des statuts des rendez-vous
import React from 'react';

export type StatutType = 'PLANIFIE' | 'CONFIRME' | 'ANNULE' | 'TERMINE' | 'ABSENT';

export interface StatusConfig {
  label: string;
  badge: 'orange' | 'green' | 'red' | 'purple' | 'gray' | 'blue' | 'default';
  icon: string;
  color: string;
  bgColor: string;
}

export const STATUS: Record<StatutType, StatusConfig> = {
  PLANIFIE: { 
    label: 'Planifié',  
    badge: 'orange', 
    icon: 'calendar',  // Icône calendrier SVG
    color: '#ff9800',
    bgColor: '#fff3e0'
  },
  CONFIRME: { 
    label: 'Confirmé',  
    badge: 'green',  
    icon: 'check',  // Icône check SVG
    color: '#4caf50',
    bgColor: '#e8f5e8'
  },
  ANNULE: { 
    label: 'Annulé',    
    badge: 'red',    
    icon: 'ban',  // Icône interdiction SVG
    color: '#f44336',
    bgColor: '#ffebee'
  },
  TERMINE: { 
    label: 'Terminé',   
    badge: 'gray',   
    icon: 'done',  // Icône terminé SVG
    color: '#9e9e9e',
    bgColor: '#f5f5f5'
  },
  ABSENT: { 
    label: 'Absent',    
    badge: 'purple', 
    icon: 'close-circle',  // Icône absent SVG
    color: '#9c27b0',
    bgColor: '#f3e5f5'
  }
};

// Helpers centralisés
export const getStatusLabel = (status: string): string => STATUS[status as StatutType]?.label ?? status;
export const getStatusColor = (status: string): string => STATUS[status as StatutType]?.color ?? '#666666';
export const getStatusBackgroundColor = (status: string): string => STATUS[status as StatutType]?.bgColor ?? '#f5f5f5';
export const getStatusBadgeClass = (status: string): string => `badge-${STATUS[status as StatutType]?.badge ?? 'default'}`;
export const getStatusIcon = (status: string): string => STATUS[status as StatutType]?.icon ?? '❓';

// Helpers pour les classes Tailwind
export const getStatusTailwindClasses = (status: string): string => {
  const badgeColors: Record<string, string> = {
    'orange': 'bg-orange-50 border-l-4 border-l-orange-500',
    'green': 'bg-green-50 border-l-4 border-l-green-500',
    'red': 'bg-red-50 border-l-4 border-l-red-500',
    'purple': 'bg-purple-50 border-l-4 border-l-purple-500',
    'gray': 'bg-gray-50 border-l-4 border-l-gray-500',
    'blue': 'bg-blue-50 border-l-4 border-l-blue-500',
    'default': 'bg-gray-50 border-l-4 border-l-gray-500'
  };
  
  const badgeClass = STATUS[status as StatutType]?.badge ?? 'blue';
  return badgeColors[badgeClass] ?? 'bg-blue-50 border-l-4 border-l-blue-500';
};

export const getStatusBadgeTailwindClasses = (status: string): string => {
  const badgeColors: Record<string, string> = {
    'orange': 'bg-orange-100 text-orange-800',
    'green': 'bg-green-100 text-green-800',
    'red': 'bg-red-100 text-red-800',
    'purple': 'bg-purple-100 text-purple-800',
    'gray': 'bg-gray-100 text-gray-800',
    'blue': 'bg-blue-100 text-blue-800',
    'default': 'bg-gray-100 text-gray-800'
  };
  
  const badgeClass = STATUS[status as StatutType]?.badge ?? 'blue';
  return badgeColors[badgeClass] ?? 'bg-blue-100 text-blue-800';
};

export const getStatusInfo = (status: string): StatusConfig => STATUS[status as StatutType] ?? {
  label: status,
  badge: 'default',
  icon: 'help',
  color: '#666666',
  bgColor: '#f5f5f5'
} as StatusConfig;

// Helper pour obtenir l'icône SVG en fonction du type
export const getStatusIconSVG = (iconType: string, className: string = "w-4 h-4"): React.JSX.Element => {
  switch (iconType) {
    case 'calendar':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'check':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'ban':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      );
    case 'done':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'close-circle':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

// Helpers avancés
export const isActiveStatus = (status: string): boolean => ['PLANIFIE', 'CONFIRME'].includes(status);
export const isTerminalStatus = (status: string): boolean => ['ANNULE', 'TERMINE', 'ABSENT'].includes(status);
export const getActiveStatuses = (): StatutType[] => ['PLANIFIE', 'CONFIRME'];
export const getTerminalStatuses = (): StatutType[] => ['ANNULE', 'TERMINE', 'ABSENT'];
