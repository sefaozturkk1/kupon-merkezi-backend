import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/live',
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LiveGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Kupona abone ol (canlı güncellemeler için)
  @SubscribeMessage('subscribeCoupon')
  handleSubscribeCoupon(client: Socket, couponId: string) {
    client.join(`coupon:${couponId}`);
    this.logger.log(`Client ${client.id} subscribed to coupon ${couponId}`);
  }

  // Kupon aboneliğinden çık
  @SubscribeMessage('unsubscribeCoupon')
  handleUnsubscribeCoupon(client: Socket, couponId: string) {
    client.leave(`coupon:${couponId}`);
  }

  // Maça abone ol
  @SubscribeMessage('subscribeMatch')
  handleSubscribeMatch(client: Socket, matchId: string) {
    client.join(`match:${matchId}`);
  }

  // Kupon güncelleme yayınla
  emitCouponUpdate(couponId: string, data: any) {
    this.server.to(`coupon:${couponId}`).emit('couponUpdate', data);
  }

  // Maç skoru güncelleme yayınla
  emitMatchUpdate(matchId: string, data: any) {
    this.server.to(`match:${matchId}`).emit('matchUpdate', data);
  }

  // Genel akış güncelleme
  emitFeedUpdate(data: any) {
    this.server.emit('feedUpdate', data);
  }
}
