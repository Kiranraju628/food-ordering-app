package com.foodapp.controller;

import com.foodapp.entity.Coupon;
import com.foodapp.entity.Notification;
import com.foodapp.entity.Order;
import com.foodapp.entity.Restaurant;
import com.foodapp.entity.User;
import com.foodapp.entity.FoodItem;
import com.foodapp.entity.Category;
import com.foodapp.entity.Role;
import com.foodapp.enums.Enums.OrderStatus;
import com.foodapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.HashMap;
import java.util.HashSet;
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
    private final FoodItemRepository foodItemRepository;
    private final CategoryRepository categoryRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

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

    // --- Restaurants CRUD ---

    @GetMapping("/restaurants")
    public ResponseEntity<List<Restaurant>> getAllRestaurants() {
        return ResponseEntity.ok(restaurantRepository.findAll());
    }

    @PostMapping("/restaurants")
    @Transactional
    public ResponseEntity<?> createRestaurant(@RequestBody Map<String, String> payload) {
        String ownerUsername = payload.get("ownerUsername");
        User owner = userRepository.findByUsername(ownerUsername).orElse(null);
        if (owner == null) {
            Role restaurantRole = roleRepository.findByName(com.foodapp.enums.Enums.RoleName.ROLE_RESTAURANT).orElseThrow();
            owner = User.builder()
                    .username(ownerUsername)
                    .email(ownerUsername + "@foodapp.com")
                    .phone(payload.get("phone"))
                    .password(passwordEncoder.encode("password123"))
                    .enabled(true)
                    .roles(new HashSet<>(List.of(restaurantRole)))
                    .build();
            owner = userRepository.save(owner);
        }

        Restaurant restaurant = Restaurant.builder()
                .owner(owner)
                .name(payload.get("name"))
                .description(payload.get("description"))
                .address(payload.get("address"))
                .phone(payload.get("phone"))
                .imageUrl(payload.get("imageUrl") != null && !payload.get("imageUrl").isBlank() ? payload.get("imageUrl") : "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500")
                .approved(true)
                .build();
        restaurantRepository.save(restaurant);
        return ResponseEntity.ok("Restaurant created successfully with owner: " + ownerUsername);
    }

    @PutMapping("/restaurants/{restId}")
    @Transactional
    public ResponseEntity<?> updateRestaurant(@PathVariable("restId") Long restId, @RequestBody Map<String, String> payload) {
        Restaurant restaurant = restaurantRepository.findById(restId).orElseThrow();
        restaurant.setName(payload.get("name"));
        restaurant.setDescription(payload.get("description"));
        restaurant.setAddress(payload.get("address"));
        restaurant.setPhone(payload.get("phone"));
        if (payload.get("imageUrl") != null) {
            restaurant.setImageUrl(payload.get("imageUrl"));
        }
        if (payload.get("approved") != null) {
            restaurant.setApproved(Boolean.parseBoolean(payload.get("approved")));
        }
        restaurantRepository.save(restaurant);
        return ResponseEntity.ok("Restaurant updated successfully");
    }

    @DeleteMapping("/restaurants/{restId}")
    @Transactional
    public ResponseEntity<?> deleteRestaurant(@PathVariable("restId") Long restId) {
        Restaurant restaurant = restaurantRepository.findById(restId).orElseThrow();
        List<FoodItem> items = foodItemRepository.findByRestaurant(restaurant);
        foodItemRepository.deleteAll(items);
        restaurantRepository.delete(restaurant);
        return ResponseEntity.ok("Restaurant and its menu items deleted successfully");
    }

    // --- Menu Management CRUD ---

    @GetMapping("/restaurants/{restId}/menu")
    public ResponseEntity<List<FoodItem>> getRestaurantMenuAdmin(@PathVariable("restId") Long restId) {
        Restaurant restaurant = restaurantRepository.findById(restId).orElseThrow();
        return ResponseEntity.ok(foodItemRepository.findByRestaurant(restaurant));
    }

    @PostMapping("/restaurants/{restId}/menu")
    @Transactional
    public ResponseEntity<?> addMenuItemAdmin(@PathVariable("restId") Long restId, @RequestBody FoodItem foodItem, @RequestParam("categoryId") Long categoryId) {
        Restaurant restaurant = restaurantRepository.findById(restId).orElseThrow();
        Category category = categoryRepository.findById(categoryId).orElseThrow();
        foodItem.setRestaurant(restaurant);
        foodItem.setCategory(category);
        foodItem.setAvailable(true);
        foodItemRepository.save(foodItem);
        return ResponseEntity.ok("Menu item added successfully to " + restaurant.getName());
    }

    @PutMapping("/restaurants/menu/{itemId}")
    @Transactional
    public ResponseEntity<?> updateMenuItemAdmin(@PathVariable("itemId") Long itemId, @RequestBody FoodItem updatedItem, @RequestParam(name = "categoryId", required = false) Long categoryId) {
        FoodItem foodItem = foodItemRepository.findById(itemId).orElseThrow();
        foodItem.setName(updatedItem.getName());
        foodItem.setDescription(updatedItem.getDescription());
        foodItem.setPrice(updatedItem.getPrice());
        foodItem.setAvailable(updatedItem.isAvailable());
        if (updatedItem.getImageUrl() != null) {
            foodItem.setImageUrl(updatedItem.getImageUrl());
        }
        if (categoryId != null) {
            Category category = categoryRepository.findById(categoryId).orElseThrow();
            foodItem.setCategory(category);
        }
        foodItemRepository.save(foodItem);
        return ResponseEntity.ok("Menu item updated successfully");
    }

    @DeleteMapping("/restaurants/menu/{itemId}")
    @Transactional
    public ResponseEntity<?> deleteMenuItemAdmin(@PathVariable("itemId") Long itemId) {
        FoodItem foodItem = foodItemRepository.findById(itemId).orElseThrow();
        foodItemRepository.delete(foodItem);
        return ResponseEntity.ok("Menu item deleted successfully");
    }

    // --- Update Order Status ---

    @PutMapping("/orders/{orderId}/status")
    @Transactional
    public ResponseEntity<?> updateOrderStatusAdmin(@PathVariable("orderId") Long orderId, @RequestParam("status") String status) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        OrderStatus newStatus = OrderStatus.valueOf(status.toUpperCase());
        order.setStatus(newStatus);
        orderRepository.save(order);

        // Notify customer
        notificationRepository.save(Notification.builder()
                .user(order.getCustomer())
                .message("Your order #" + order.getId() + " status has been updated by Admin to: " + newStatus)
                .build());

        return ResponseEntity.ok("Order status updated successfully to " + newStatus);
    }
}
