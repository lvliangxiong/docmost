import {
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../core/auth/services/token.service';
import { JwtPayload, JwtType } from '../core/auth/dto/jwt-payload';
import { OnModuleDestroy } from '@nestjs/common';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import * as cookie from 'cookie';

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket'],
})
export class WsGateway implements OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer()
  server: Server;
  
  // Map to track which sockets belong to which users
  private userSocketMap = new Map<string, Set<string>>();
  
  constructor(
    private tokenService: TokenService,
    private spaceMemberRepo: SpaceMemberRepo,
  ) {}

  async handleConnection(client: Socket, ...args: any[]): Promise<void> {
    try {
      const cookies = cookie.parse(client.handshake.headers.cookie || '');
      const token: JwtPayload = await this.tokenService.verifyJwt(
        cookies['authToken'],
        JwtType.ACCESS,
      );

      const userId = token.sub;
      const workspaceId = token.workspaceId;

      // Store user-socket mapping
      if (!this.userSocketMap.has(userId)) {
        this.userSocketMap.set(userId, new Set());
      }
      this.userSocketMap.get(userId)!.add(client.id);

      // Store user info on socket for later use
      (client as any).userId = userId;
      (client as any).workspaceId = workspaceId;

      const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

      const workspaceRoom = `workspace-${workspaceId}`;
      const userRoom = `user-${userId}`;
      const spaceRooms = userSpaceIds.map((id) => this.getSpaceRoomName(id));

      client.join([workspaceRoom, userRoom, ...spaceRooms]);
    } catch (err) {
      client.emit('Unauthorized');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    // Clean up user-socket mapping
    const userId = (client as any).userId;
    if (userId && this.userSocketMap.has(userId)) {
      const userSockets = this.userSocketMap.get(userId)!;
      userSockets.delete(client.id);
      if (userSockets.size === 0) {
        this.userSocketMap.delete(userId);
      }
    }
  }

  @SubscribeMessage('message')
  handleMessage(client: Socket, data: any): void {
    const spaceEvents = [
      'updateOne',
      'addTreeNode',
      'moveTreeNode',
      'deleteTreeNode',
    ];

    if (spaceEvents.includes(data?.operation) && data?.spaceId) {
      const room = this.getSpaceRoomName(data.spaceId);
      client.broadcast.to(room).emit('message', data);
      return;
    }

    client.broadcast.emit('message', data);
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, @MessageBody() roomName: string): void {
    // if room is a space, check if user has permissions
    //client.join(roomName);
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(client: Socket, @MessageBody() roomName: string): void {
    client.leave(roomName);
  }

  onModuleDestroy() {
    if (this.server) {
      this.server.close();
    }
  }

  getSpaceRoomName(spaceId: string): string {
    return `space-${spaceId}`;
  }

  /**
   * Emit an event to a specific user
   */
  emitToUser(userId: string, event: string, data: any): void {
    const userRoom = `user-${userId}`;
    this.server.to(userRoom).emit(event, data);
  }

  /**
   * Emit an event to a workspace
   */
  emitToWorkspace(workspaceId: string, event: string, data: any): void {
    const workspaceRoom = `workspace-${workspaceId}`;
    this.server.to(workspaceRoom).emit(event, data);
  }

  /**
   * Emit an event to a space
   */
  emitToSpace(spaceId: string, event: string, data: any): void {
    const spaceRoom = this.getSpaceRoomName(spaceId);
    this.server.to(spaceRoom).emit(event, data);
  }

  /**
   * Check if a user is currently connected
   */
  isUserConnected(userId: string): boolean {
    return this.userSocketMap.has(userId) && this.userSocketMap.get(userId)!.size > 0;
  }
}