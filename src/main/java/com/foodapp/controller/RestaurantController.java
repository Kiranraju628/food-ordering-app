package com.foodapp.controller;

import com.foodapp.entity.*;
import com.foodapp.enums.Enums.OrderStatus;
import com.foodapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/restaurant")
@RequiredArgsConstructor
public class RestaurantController {

    private final UserRepository userRepository;
    private final RestaurantRepository restaurantRepository;
    private final FoodItemRepository foodItemRepository;
    private final CategoryRepository categoryRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final NotificationRepository notificationRepository;

    private Restaurant getOwnerRestaurant(Principal principal) {
        User user = userRepository.findByUsername(principal.getName()).orElseThrow();
        return restaurantRepository.findByOwner(user)
                .orElseThrow(() -> new RuntimeException("Restaurant profile not found for owner: " + user.getUsername()));
    }

    @GetMapping("/menu")
    public ResponseEntity<?> getMenu(Principal principal) {
        Restaurant restaurant = getOwnerRestaurant(principal);
        return ResponseEntity.ok(foodItemRepository.findByRestaurant(restaurant));
    }

    @PostMapping("/menu/add")
    public ResponseEntity<?> addMenuItem(@RequestBody FoodItem foodItem, @RequestParam("categoryId") Long categoryId, Principal principal) {
        Restaurant restaurant = getOwnerRestaurant(principal);
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new RuntimeException("Category not found"));

        foodItem.setRestaurant(restaurant);
        foodItem.setCategory(category);
        foodItem.setAvailable(true);

        foodItemRepository.save(foodItem);
        return ResponseEntity.ok("Menu item added successfully");
    }

    @PutMapping("/menu/{itemId}/update")
    public ResponseEntity<?> updateMenuItem(@PathVariable("itemId") Long itemId, @RequestBody FoodItem updatedItem, @RequestParam(name = "categoryId", required = false) Long categoryId, Principal principal) {
        Restaurant restaurant = getOwnerRestaurant(principal);
        FoodItem foodItem = foodItemRepository.findById(itemId).orElseThrow();

        if (!foodItem.getRestaurant().getId().equals(restaurant.getId())) {
            return ResponseEntity.status(403).body("Access denied");
        }

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

    @DeleteMapping("/menu/{itemId}/delete")
    public ResponseEntity<?> deleteMenuItem(@PathVariable("itemId") Long itemId, Principal principal) {
        Restaurant restaurant = getOwnerRestaurant(principal);
        FoodItem foodItem = foodItemRepository.findById(itemId).orElseThrow();

        if (!foodItem.getRestaurant().getId().equals(restaurant.getId())) {
            return ResponseEntity.status(403).body("Access denied");
        }

        foodItemRepository.delete(foodItem);
        return ResponseEntity.ok("Menu item deleted successfully");
    }

    @GetMapping("/orders")
    public ResponseEntity<?> getIncomingOrders(Principal principal) {
        Restaurant restaurant = getOwnerRestaurant(principal);
        List<Order> orders = orderRepository.findByRestaurant(restaurant);
        return ResponseEntity.ok(orders);
    }

    @GetMapping("/orders/{orderId}/items")
    public ResponseEntity<?> getOrderItems(@PathVariable("orderId") Long orderId, Principal principal) {
        Restaurant restaurant = getOwnerRestaurant(principal);
        Order order = orderRepository.findById(orderId).orElseThrow();
        if (!order.getRestaurant().getId().equals(restaurant.getId())) {
            return ResponseEntity.status(403).body("Access denied");
        }
        return ResponseEntity.ok(orderItemRepository.findByOrder(order));
    }

    @PutMapping("/orders/{orderId}/status")
    @Transactional
    public ResponseEntity<?> updateOrderStatus(@PathVariable("orderId") Long orderId, @RequestParam("status") String status, Principal principal) {
        Restaurant restaurant = getOwnerRestaurant(principal);
        Order order = orderRepository.findById(orderId).orElseThrow();

        if (!order.getRestaurant().getId().equals(restaurant.getId())) {
            return ResponseEntity.status(403).body("Access denied");
        }

        OrderStatus newStatus = OrderStatus.valueOf(status.toUpperCase());
        order.setStatus(newStatus);
        orderRepository.save(order);

        // Send notification to customer
        notificationRepository.save(Notification.builder()
                .user(order.getCustomer())
                .message("Your order #" + order.getId() + " is now: " + newStatus)
                .build());

        // Notify delivery riders if ready for pickup
        if (newStatus == OrderStatus.READY_FOR_PICKUP) {
            // Find all delivery partners and notify them
            // In a small DB, notify all users with role ROLE_DELIVERY
            List<User> riders = userRepository.findAllByRoleName(com.foodapp.enums.Enums.RoleName.ROLE_DELIVERY);
            for (User rider : riders) {
                notificationRepository.save(Notification.builder()
                        .user(rider)
                        .message("Order #" + order.getId() + " from " + restaurant.getName() + " is ready for pickup!")
                        .build());
            }
        }

        return ResponseEntity.ok("Order status updated to " + newStatus);
    }
}
