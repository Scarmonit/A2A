import { EventEmitter } from 'events';

export type Permission = string; // e.g., 'file:read', 'network:http', 'agent:invoke'

export type PermissionGrant = {
  id: string;
  grantedBy: string;
  grantedTo: string;
  permission: Permission;
  delegable: boolean; // Can the recipient grant this permission to others?
  expiresAt?: number;
  conditions?: PermissionCondition[];
  grantedAt: number;
  revoked: boolean;
};

export type PermissionCondition = {
  type: 'time_range' | 'resource_limit' | 'usage_count' | 'context_match';
  parameters: Record<string, any>;
};

export type PermissionRequest = {
  id: string;
  requesterId: string;
  targetAgentId: string;
  permission: Permission;
  reason: string;
  requestedAt: number;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  approvedBy?: string;
  approvedAt?: number;
  expiresAt?: number;
};

export class PermissionManager extends EventEmitter {
  private grants = new Map<string, PermissionGrant>();
  private requests = new Map<string, PermissionRequest>();
  private agentPermissions = new Map<string, Set<Permission>>(); // Built-in permissions
  private delegationChains = new Map<string, string[]>(); // Track permission chains

  constructor() {
    super();
    this.setupCleanupInterval();
  }

  // Initialize agent with base permissions
  initializeAgent(agentId: string, basePermissions: Permission[]): void {
    this.agentPermissions.set(agentId, new Set(basePermissions));
    this.emit('agentInitialized', { agentId, permissions: basePermissions });
  }

  // Check if agent has permission (including delegated)
  hasPermission(agentId: string, permission: Permission, context?: any): boolean {
    // Check base permissions
    const basePerms = this.agentPermissions.get(agentId);
    if (basePerms?.has(permission) || basePerms?.has('*')) {
      return true;
    }

    // Check granted permissions
    for (const grant of this.grants.values()) {
      if (grant.grantedTo === agentId && 
          grant.permission === permission && 
          !grant.revoked && 
          this.isGrantValid(grant, context)) {
        return true;
      }
    }

    return false;
  }

  // Grant permission from one agent to another
  async grantPermission(
    granterId: string, 
    targetAgentId: string, 
    permission: Permission,
    options: {
      delegable?: boolean;
      expiresIn?: number;
      conditions?: PermissionCondition[];
      reason?: string;
    } = {}
  ): Promise<{ success: boolean; grantId?: string; error?: string }> {
    
    // Verify granter has permission to grant
    if (!this.canGrantPermission(granterId, permission)) {
      return { 
        success: false, 
        error: `Agent ${granterId} cannot grant permission '${permission}'` 
      };
    }

    const grantId = `grant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const expiresAt = options.expiresIn ? Date.now() + options.expiresIn : undefined;

    const grant: PermissionGrant = {
      id: grantId,
      grantedBy: granterId,
      grantedTo: targetAgentId,
      permission,
      delegable: options.delegable || false,
      expiresAt,
      conditions: options.conditions,
      grantedAt: Date.now(),
      revoked: false
    };

    this.grants.set(grantId, grant);
    
    // Track delegation chain
    const chain = this.delegationChains.get(permission) || [];
    chain.push(`${granterId}->${targetAgentId}`);
    this.delegationChains.set(permission, chain);

    this.emit('permissionGranted', { grant, reason: options.reason });

    return { success: true, grantId };
  }

  // Request permission from another agent
  async requestPermission(
    requesterId: string,
    targetAgentId: string,
    permission: Permission,
    reason: string,
    expiresIn: number = 24 * 60 * 60 * 1000 // 24 hours default
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    const request: PermissionRequest = {
      id: requestId,
      requesterId,
      targetAgentId,
      permission,
      reason,
      requestedAt: Date.now(),
      status: 'pending',
      expiresAt: Date.now() + expiresIn
    };

    this.requests.set(requestId, request);
    this.emit('permissionRequested', request);

    // Auto-approve for certain scenarios (configurable)
    if (this.shouldAutoApprove(request)) {
      return this.approvePermissionRequest(targetAgentId, requestId, 'auto-approved');
    }

    return { success: true, requestId };
  }

  // Approve permission request
  async approvePermissionRequest(
    approverId: string,
    requestId: string,
    reason?: string
  ): Promise<{ success: boolean; grantId?: string; error?: string }> {
    
    const request = this.requests.get(requestId);
    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: 'Request already processed' };
    }

    if (request.expiresAt && Date.now() > request.expiresAt) {
      request.status = 'expired';
      return { success: false, error: 'Request expired' };
    }

    // Verify approver can grant this permission
    if (!this.canGrantPermission(approverId, request.permission)) {
      return { 
        success: false, 
        error: `Agent ${approverId} cannot approve permission '${request.permission}'` 
      };
    }

    // Grant the permission
    const grantResult = await this.grantPermission(
      approverId,
      request.requesterId,
      request.permission,
      { reason: `Approved request: ${reason || request.reason}` }
    );

    if (grantResult.success) {
      request.status = 'approved';
      request.approvedBy = approverId;
      request.approvedAt = Date.now();
    }

    return grantResult;
  }

  // Revoke permission
  revokePermission(
    revokerId: string, 
    grantId: string, 
    reason?: string
  ): { success: boolean; error?: string } {
    
    const grant = this.grants.get(grantId);
    if (!grant) {
      return { success: false, error: 'Grant not found' };
    }

    // Only granter or recipient can revoke
    if (grant.grantedBy !== revokerId && grant.grantedTo !== revokerId) {
      return { success: false, error: 'Insufficient privileges to revoke' };
    }

    grant.revoked = true;
    this.emit('permissionRevoked', { grant, revokerId, reason });

    return { success: true };
  }

  // Get all permissions for an agent
  getAgentPermissions(agentId: string): {
    base: Permission[];
    granted: PermissionGrant[];
    effective: Permission[];
  } {
    const base = Array.from(this.agentPermissions.get(agentId) || []);
    const granted = Array.from(this.grants.values()).filter(g => 
      g.grantedTo === agentId && !g.revoked && this.isGrantValid(g)
    );
    
    const effectiveSet = new Set(base);
    granted.forEach(g => effectiveSet.add(g.permission));
    
    return {
      base,
      granted,
      effective: Array.from(effectiveSet)
    };
  }

  // Get pending requests for an agent
  getPendingRequests(targetAgentId: string): PermissionRequest[] {
    return Array.from(this.requests.values()).filter(r =>
      r.targetAgentId === targetAgentId && 
      r.status === 'pending' &&
      (!r.expiresAt || Date.now() < r.expiresAt)
    );
  }

  // Get delegation chain for a permission
  getDelegationChain(permission: Permission): string[] {
    return this.delegationChains.get(permission) || [];
  }

  // Agent marketplace - advertise capabilities
  advertiseCapabilities(agentId: string, capabilities: {
    tools: string[];
    permissions: Permission[];
    description: string;
    pricing?: { permission: Permission; cost: number }[];
  }): void {
    this.emit('capabilitiesAdvertised', { agentId, capabilities });
  }

  private canGrantPermission(granterId: string, permission: Permission): boolean {
    // Agent can grant if they have the permission and it's delegable, or they have admin rights
    const hasBase = this.hasPermission(granterId, permission);
    const hasAdmin = this.hasPermission(granterId, 'admin:grant-permissions');
    
    if (hasAdmin) return true;
    if (!hasBase) return false;

    // Check if any granted permission that gives this permission is delegable
    for (const grant of this.grants.values()) {
      if (grant.grantedTo === granterId &&
          grant.permission === permission &&
          grant.delegable &&
          !grant.revoked &&
          this.isGrantValid(grant)) {
        return true;
      }
    }

    // If it's a base permission, check if agent type allows delegation
    return (this.agentPermissions.get(granterId)?.has(permission) || false) && 
           this.agentCanDelegate(granterId);
  }

  private isGrantValid(grant: PermissionGrant, context?: any): boolean {
    if (grant.revoked) return false;
    if (grant.expiresAt && Date.now() > grant.expiresAt) return false;
    
    // Check conditions
    if (grant.conditions) {
      for (const condition of grant.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          return false;
        }
      }
    }
    
    return true;
  }

  private evaluateCondition(condition: PermissionCondition, context?: any): boolean {
    switch (condition.type) {
      case 'time_range':
        const now = Date.now();
        return now >= condition.parameters.start && now <= condition.parameters.end;
      
      case 'usage_count':
        // Implementation would track usage count
        return true; // Simplified
      
      case 'context_match':
        return context && context[condition.parameters.key] === condition.parameters.value;
      
      default:
        return true;
    }
  }

  private shouldAutoApprove(request: PermissionRequest): boolean {
    // Auto-approve requests for basic permissions between certain agent types
    const basicPermissions = ['file:read', 'data:process'];
    return basicPermissions.includes(request.permission) && 
           request.requesterId.startsWith('data-processor') &&
           request.targetAgentId.startsWith('file-ops');
  }

  private agentCanDelegate(agentId: string): boolean {
    // Determine if agent type can delegate based on its role
    return agentId.startsWith('admin') || 
           agentId.includes('coordinator') ||
           this.hasPermission(agentId, 'permission:delegate');
  }

  private setupCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpiredGrants();
      this.cleanupExpiredRequests();
    }, 60000); // Clean up every minute
  }

  private cleanupExpiredGrants(): void {
    for (const [id, grant] of this.grants.entries()) {
      if (grant.expiresAt && Date.now() > grant.expiresAt) {
        grant.revoked = true;
        this.emit('permissionExpired', { grant });
      }
    }
  }

  private cleanupExpiredRequests(): void {
    for (const [id, request] of this.requests.entries()) {
      if (request.expiresAt && Date.now() > request.expiresAt && request.status === 'pending') {
        request.status = 'expired';
        this.emit('requestExpired', { request });
      }
    }
  }
}

export const permissionManager = new PermissionManager();