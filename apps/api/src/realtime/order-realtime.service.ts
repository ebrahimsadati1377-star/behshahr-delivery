import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export type OrderRealtimeReason =
  | 'ORDER_STATUS'
  | 'COURIER_LOCATION'
  | 'PAYMENT_STATUS';

export interface OrderRealtimeSignal {
  orderId: string;
  reason: OrderRealtimeReason;
  emittedAt: string;
}

interface Channel {
  subject: Subject<OrderRealtimeSignal>;
  subscribers: number;
}

@Injectable()
export class OrderRealtimeService {
  private readonly channels = new Map<string, Channel>();

  subscribe(orderId: string): Observable<OrderRealtimeSignal> {
    return new Observable<OrderRealtimeSignal>((subscriber) => {
      let channel = this.channels.get(orderId);
      if (!channel) {
        channel = { subject: new Subject<OrderRealtimeSignal>(), subscribers: 0 };
        this.channels.set(orderId, channel);
      }

      channel.subscribers += 1;
      const subscription = channel.subject.subscribe(subscriber);

      return () => {
        subscription.unsubscribe();
        const current = this.channels.get(orderId);
        if (!current) return;
        current.subscribers -= 1;
        if (current.subscribers <= 0) {
          current.subject.complete();
          this.channels.delete(orderId);
        }
      };
    });
  }

  publish(orderId: string, reason: OrderRealtimeReason): void {
    const channel = this.channels.get(orderId);
    if (!channel) return;

    channel.subject.next({
      orderId,
      reason,
      emittedAt: new Date().toISOString(),
    });
  }
}
