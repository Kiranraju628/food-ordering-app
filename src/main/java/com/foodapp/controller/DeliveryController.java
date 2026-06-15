package com.foodapp.controller;

import com.foodapp.entity.*;
import com.foodapp.enums.Enums.DeliveryStatus;
import com.foodapp.enums.Enums.OrderStatus;
import com.foodapp.enums.Enums.PaymentStatus;
import com.foodapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/delivery")
@RequiredArgsConstructor
public class DeliveryController {

    private final UserRepository userRepository;
    private final DeliveryPartnerRepository deliveryPartnerRepository;
    private final OrderRepository orderRepository;
    private final DeliveryRepository deliveryRepository;
    private final PaymentRepository paymentRepository;
    private final NotificationRepository notificationRepository;

    private DeliveryPartner getAuthenticatedRider(Principal principal) {
        User user = userRepository.findByUsername(principal.getName()).orElseThrow();
        return deliveryPartnerRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("Rider profile not found: " + user.getUsername()));
    }

    @GetMapping("/pending")
    public ResponseEntity<List<Order>> getPendingDeliveryRequests() {
        // Orders that are READY_FOR_PICKUP and do not have a delivery partner assigned yet
        List<Order> orders = orderRepository.findByStatus(OrderStatus.READY_FOR_PICKUP);
        orders.removeIf(o -> o.getDeliveryPartner() != null);
        return ResponseEntity.ok(orders);
    }

    @GetMapping("/active")
    public ResponseEntity<?> getActiveDelivery(Principal principal) {
        DeliveryPartner partner = getAuthenticatedRider(principal);
        // Find deliveries that are not completed (i.e. status is ASSIGNED or PICKED_UP)
        List<Delivery> deliveries = deliveryRepository.findByDeliveryPartner(partner);
        Optional<Delivery> active = deliveries.stream()
                .filter(d -> d.getStatus() != DeliveryStatus.DELIVERED)
                .findFirst();

        if (active.isPresent()) {
            return ResponseEntity.ok(active.get());
        }
        return ResponseEntity.ok(Map.of("message", "No active delivery job"));
    }

    @PostMapping("/accept/{orderId}")
    @Transactional
    public ResponseEntity<?> acceptDeliveryRequest(@PathVariable("orderId") Long orderId, Principal principal) {
        DeliveryPartner partner = getAuthenticatedRider(principal);
        Order order = orderRepository.findById(orderId).orElseThrow();

        if (order.getDeliveryPartner() != null) {
            return ResponseEntity.badRequest().body("Delivery already accepted by another partner");
        }

        // Assign rider
        order.setDeliveryPartner(partner);
        orderRepository.save(order);

        Delivery delivery = Delivery.builder()
                .order(order)
                .deliveryPartner(partner)
                .status(DeliveryStatus.ASSIGNED)
                .build();
        deliveryRepository.save(delivery);

        // Notify customer
        notificationRepository.save(Notification.builder()
                .user(order.getCustomer())
                .message("Delivery partner " + partner.getUser().getUsername() + " is assigned to your order #" + order.getId())
                .build());

        return ResponseEntity.ok("Delivery request accepted");
    }

    @PostMapping("/pickup/{orderId}")
    @Transactional
    public ResponseEntity<?> pickupFood(@PathVariable("orderId") Long orderId, Principal principal) {
        DeliveryPartner partner = getAuthenticatedRider(principal);
        Delivery delivery = deliveryRepository.findByOrder(orderRepository.findById(orderId).orElseThrow())
                .orElseThrow(() -> new RuntimeException("Delivery details not found"));

        if (!delivery.getDeliveryPartner().getId().equals(partner.getId())) {
            return ResponseEntity.status(403).body("Access denied");
        }

        delivery.setStatus(DeliveryStatus.PICKED_UP);
        delivery.setPickupTime(LocalDateTime.now());
        deliveryRepository.save(delivery);

        Order order = delivery.getOrder();
        order.setStatus(OrderStatus.OUT_FOR_DELIVERY);
        orderRepository.save(order);

        // Notify customer
        notificationRepository.save(Notification.builder()
                .user(order.getCustomer())
                .message("Your order #" + order.getId() + " has been picked up and is out for delivery!")
                .build());

        return ResponseEntity.ok("Order marked as picked up");
    }

    @PostMapping("/deliver/{orderId}")
    @Transactional
    public ResponseEntity<?> markDelivered(@PathVariable("orderId") Long orderId, Principal principal) {
        DeliveryPartner partner = getAuthenticatedRider(principal);
        Delivery delivery = deliveryRepository.findByOrder(orderRepository.findById(orderId).orElseThrow())
                .orElseThrow(() -> new RuntimeException("Delivery details not found"));

        if (!delivery.getDeliveryPartner().getId().equals(partner.getId())) {
            return ResponseEntity.status(403).body("Access denied");
        }

        delivery.setStatus(DeliveryStatus.DELIVERED);
        delivery.setDeliveryTime(LocalDateTime.now());
        deliveryRepository.save(delivery);

        Order order = delivery.getOrder();
        order.setStatus(OrderStatus.DELIVERED);
        orderRepository.save(order);

        // Complete payment if COD
        Optional<Payment> paymentOpt = paymentRepository.findByOrder(order);
        if (paymentOpt.isPresent()) {
            Payment payment = paymentOpt.get();
            if (payment.getStatus() == PaymentStatus.PENDING) {
                payment.setStatus(PaymentStatus.COMPLETED);
                paymentRepository.save(payment);
            }
        }

        // Notify customer
        notificationRepository.save(Notification.builder()
                .user(order.getCustomer())
                .message("Your order #" + order.getId() + " has been delivered successfully! Bon Appetit!")
                .build());

        // Notify restaurant owner
        notificationRepository.save(Notification.builder()
                .user(order.getRestaurant().getOwner())
                .message("Order #" + order.getId() + " has been delivered by " + partner.getUser().getUsername())
                .build());

        return ResponseEntity.ok("Order marked as delivered");
    }

    @GetMapping("/history")
    public ResponseEntity<List<Delivery>> getDeliveryHistory(Principal principal) {
        DeliveryPartner partner = getAuthenticatedRider(principal);
        return ResponseEntity.ok(deliveryRepository.findByDeliveryPartner(partner));
    }
}
