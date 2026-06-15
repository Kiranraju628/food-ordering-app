package com.foodapp.controller;

import com.foodapp.entity.Coupon;
import com.foodapp.entity.Notification;
import com.foodapp.entity.Order;
import com.foodapp.entity.Restaurant;
import com.foodapp.entity.User;
import com.foodapp.enums.Enums.OrderStatus;
import com.foodapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final RestaurantRepository restaurantRepository;
    private final OrderRepository orderRepository;
    private final CouponRepository couponRepository;
    private final NotificationRepository notificationRepository;

    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PutMapping("/users/{userId}/block")
    public ResponseEntity<?> toggleUserBlock(@PathVariable("userId") Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        user.setEnabled(!user.isEnabled());
        userRepository.save(user);
        String action = user.isEnabled() ? "unblocked" : "blocked";
        return ResponseEntity.ok("User " + user.getUsername() + " has been " + action);
    }

    @GetMapping("/restaurants/pending")
    public ResponseEntity<List<Restaurant>> getPendingRestaurants() {
        return ResponseEntity.ok(restaurantRepository.findByApproved(false));
    }

    @PutMapping("/restaurants/{restId}/approve")
    @Transactional
    public ResponseEntity<?> approveRestaurant(@PathVariable("restId") Long restId) {
        Restaurant restaurant = restaurantRepository.findById(restId).orElseThrow();
        restaurant.setApproved(true);
        restaurantRepository.save(restaurant);

        // Notify restaurant owner
        notificationRepository.save(Notification.builder()
                .user(restaurant.getOwner())
                .message("Your restaurant profile '" + restaurant.getName() + "' has been approved by the Admin!")
                .build());

        return ResponseEntity.ok("Restaurant '" + restaurant.getName() + "' approved successfully");
    }

    @GetMapping("/orders")
    public ResponseEntity<List<Order>> getAllOrders() {
        return ResponseEntity.ok(orderRepository.findAll());
    }

    @PutMapping("/orders/{orderId}/cancel")
    @Transactional
    public ResponseEntity<?> cancelOrder(@PathVariable("orderId") Long orderId) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);

        // Notify customer
        notificationRepository.save(Notification.builder()
                .user(order.getCustomer())
                .message("Your order #" + order.getId() + " has been cancelled by the Admin.")
                .build());

        // Notify restaurant owner
        notificationRepository.save(Notification.builder()
                .user(order.getRestaurant().getOwner())
                .message("Order #" + order.getId() + " has been cancelled by the Admin.")
                .build());

        return ResponseEntity.ok("Order #" + orderId + " cancelled successfully");
    }

    @GetMapping("/reports")
    public ResponseEntity<?> getReports() {
        List<User> users = userRepository.findAll();
        List<Restaurant> restaurants = restaurantRepository.findAll();
        List<Order> orders = orderRepository.findAll();

        long customers = users.stream().filter(u -> u.getRoles().stream().anyMatch(r -> r.getName() == com.foodapp.enums.Enums.RoleName.ROLE_CUSTOMER)).count();
        long owners = users.stream().filter(u -> u.getRoles().stream().anyMatch(r -> r.getName() == com.foodapp.enums.Enums.RoleName.ROLE_RESTAURANT)).count();
        long riders = users.stream().filter(u -> u.getRoles().stream().anyMatch(r -> r.getName() == com.foodapp.enums.Enums.RoleName.ROLE_DELIVERY)).count();

        long approvedRests = restaurants.stream().filter(Restaurant::isApproved).count();
        long pendingRests = restaurants.stream().filter(r -> !r.isApproved()).count();

        double totalRevenue = orders.stream()
                .filter(o -> o.getStatus() == OrderStatus.DELIVERED)
                .mapToDouble(Order::getTotalAmount)
                .sum();

        long totalDeliveredOrders = orders.stream().filter(o -> o.getStatus() == OrderStatus.DELIVERED).count();
        double avgOrderValue = totalDeliveredOrders > 0 ? (totalRevenue / totalDeliveredOrders) : 0.0;

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalCustomers", customers);
        stats.put("totalOwners", owners);
        stats.put("totalRiders", riders);
        stats.put("approvedRestaurants", approvedRests);
        stats.put("pendingRestaurants", pendingRests);
        stats.put("totalOrders", orders.size());
        stats.put("totalRevenue", totalRevenue);
        stats.put("averageOrderValue", avgOrderValue);

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/coupons")
    public ResponseEntity<List<Coupon>> getAllCoupons() {
        return ResponseEntity.ok(couponRepository.findAll());
    }

    @PostMapping("/coupons")
    public ResponseEntity<?> createCoupon(@RequestBody Coupon coupon) {
        if (couponRepository.findByCodeIgnoreCase(coupon.getCode()).isPresent()) {
            return ResponseEntity.badRequest().body("Coupon code already exists");
        }
        coupon.setActive(true);
        couponRepository.save(coupon);
        return ResponseEntity.ok("Coupon created successfully");
    }
}
