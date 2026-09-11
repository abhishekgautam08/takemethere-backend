import { Trip, DayPlan } from './trip.js';

export type AgentEventType =
  | 'agent_started'
  | 'tool_started'
  | 'tool_completed'
  | 'searching_places'
  | 'places_found'
  | 'calculating_routes'
  | 'routes_calculated'
  | 'finding_restaurants'
  | 'restaurants_found'
  | 'finding_rentals'
  | 'rentals_found'
  | 'building_itinerary'
  | 'optimizing_itinerary'
  | 'itinerary_ready'
  | 'agent_message'
  | 'agent_error';

export interface AgentEvent {
  type: AgentEventType;
  tripId: string;
  timestamp: number;
  message: string;
  details?: Record<string, unknown>;
  toolName?: string;
  itinerary?: DayPlan[];
  trip?: Partial<Trip>;
}

export type AgentPhase =
  | 'collecting_preferences'
  | 'researching'
  | 'planning'
  | 'optimizing'
  | 'ready'
  | 'error';

export interface AgentState {
  tripId: string;
  destination?: string;
  duration?: number;
  preferences?: {
    interests: string[];
    budget?: string;
    transport?: string;
    pace?: string;
  };
  currentPhase: AgentPhase;
  itinerary?: DayPlan[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result?: Record<string, unknown>;
  }>;
  quickOptions?: string[];
}

export interface OptimizationMetrics {
  beforeDistanceMeters: number;
  afterDistanceMeters: number;
  distanceSavedMeters: number;
  beforeDurationSeconds: number;
  afterDurationSeconds: number;
  timeSavedSeconds: number;
  summary: string;
}

export interface OptimizationResult {
  metrics: OptimizationMetrics;
  itinerary: DayPlan[];
}
