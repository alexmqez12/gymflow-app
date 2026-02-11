import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CheckinsService } from './checkins.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class CheckinsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private checkinsService: CheckinsService) {}

  handleConnection(client: Socket) {
    console.log(`🔌 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:gym')
  handleSubscribeGym(
    @ConnectedSocket() client: Socket,
    @MessageBody() gymId: string,
  ) {
    client.join(`gym:${gymId}`);
    console.log(`📍 Client ${client.id} subscribed to gym ${gymId}`);
    return { event: 'subscribed', data: { gymId } };
  }

  @SubscribeMessage('unsubscribe:gym')
  handleUnsubscribeGym(
    @ConnectedSocket() client: Socket,
    @MessageBody() gymId: string,
  ) {
    client.leave(`gym:${gymId}`);
    console.log(`📍 Client ${client.id} unsubscribed from gym ${gymId}`);
    return { event: 'unsubscribed', data: { gymId } };
  }

  // Método para emitir actualizaciones de capacidad
  async emitCapacityUpdate(gymId: string) {
    const capacity = await this.checkinsService.getCurrentCapacity(gymId);
    
    // Emitir a todos los suscritos al gym
    this.server.to(`gym:${gymId}`).emit('capacity:update', capacity);
    
    // Emitir a todos los clientes (para la lista general)
    this.server.emit('capacity:update:all', capacity);
    
    console.log(`📊 Capacity update emitted for gym ${gymId}: ${capacity.current}/${capacity.max}`);
  }

  // Método para notificar nuevo check-in
  emitCheckIn(gymId: string, data: any) {
    this.server.to(`gym:${gymId}`).emit('checkin:new', data);
    this.emitCapacityUpdate(gymId);
  }

  // Método para notificar check-out
  emitCheckOut(gymId: string, data: any) {
    this.server.to(`gym:${gymId}`).emit('checkout:new', data);
    this.emitCapacityUpdate(gymId);
  }
}