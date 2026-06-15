package com.foodapp.controller;

import com.foodapp.dto.AddToCartRequest;
import com.foodapp.dto.CheckoutRequest;
import com.foodapp.dto.ReviewRequest;
import com.foodapp.entity.*;
import com.foodapp.enums.Enums.OrderStatus;
import com.foodapp.enums.Enums.PaymentMethod;
import com.foodapp.enums.Enums.PaymentStatus;
import com.foodapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/customer")
@RequiredArgsConstructor
public class CustomerController {

    private final UserRepository userRepository;
    private final RestaurantRepository restaurantRepository;
    private final FoodItemRepository foodItemRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final PaymentRepository paymentRepository;
    private final CouponRepository couponRepository;
    private final AddressRepository addressRepository;
    private final ReviewRepository reviewRepository;
    private final NotificationRepository notificationRepository;

    private User getAuthenticatedUser(Principal principal) {
        return userRepository.findByUsername(principal.getName()).orElseThrow();
    }

    @GetMapping("/restaurants")
    public ResponseEntity<List<Restaurant>> getApprovedRestaurants() {
        return ResponseEntity.ok(restaurantRepository.findByApproved(true));
    }

    @GetMapping("/restaurants/{restId}/menu")
    public ResponseEntity<List<FoodItem>> getRestaurantMenu(@PathVariable("restId") Long restId) {
        Restaurant restaurant = restaurantRepository.findById(restId)
                .orElseThrow(() -> new RuntimeException("Restaurant not found"));
        return ResponseEntity.ok(foodItemRepository.findByRestaurantAndAvailable(restaurant, true));
    }

    @GetMapping("/food/search")
    public ResponseEntity<List<FoodItem>> searchFood(@RequestParam("query") String query) {
        return ResponseEntity.ok(foodItemRepository.findByNameContainingIgnoreCase(query));
    }

    @GetMapping("/addresses")
    public ResponseEntity<List<Address>> getAddresses(Principal principal) {
        User user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(addressRepository.findByUser(user));
    }

    @PostMapping("/addresses/add")
    public ResponseEntity<?> addAddress(@RequestBody Address address, Principal principal) {
        User user = getAuthenticatedUser(principal);
        address.setUser(user);
        addressRepository.save(address);
        return ResponseEntity.ok("Address added successfully");
    }

    @GetMapping("/cart")
    public ResponseEntity<?> getCart(Principal principal) {
        User user = getAuthenticatedUser(principal);
        Cart cart = cartRepository.findByUser(user)
                .orElseGet(() -> cartRepository.save(Cart.builder().user(user).build()));

        List<CartItem> items = cartItemRepository.findByCart(cart);
        double total = items.stream().mapToDouble(i -> i.getFoodItem().getPrice() * i.getQuantity()).sum();

        Map<String, Object> response = new HashMap<>();
        response.put("cartId", cart.getId());
        response.put("items", items);
        response.put("subTotal", total);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/cart/add")
    @Transactional
    public ResponseEntity<?> addToCart(@RequestBody AddToCartRequest request, Principal principal) {
        User user = getAuthenticatedUser(principal);
        Cart cart = cartRepository.findByUser(user)
                .orElseGet(() -> cartRepository.save(Cart.builder().user(user).build()));

        FoodItem foodItem = foodItemRepository.findById(request.getFoodItemId())
                .orElseThrow(() -> new RuntimeException("Food item not found"));

        // Verify if cart has items from another restaurant
        List<CartItem> existingItems = cartItemRepository.findByCart(cart);
        if (!existingItems.isEmpty()) {
            Restaurant currentRest = existingItems.get(0).getFoodItem().getRestaurant();
            if (!currentRest.getId().equals(foodItem.getRestaurant().getId())) {
                // Clear cart if adding from another restaurant
                cartItemRepository.deleteByCart(cart);
            }
        }

        Optional<CartItem> existingItemOpt = cartItemRepository.findByCartAndFoodItem(cart, foodItem);
        if (existingItemOpt.isPresent()) {
            CartItem cartItem = existingItemOpt.get();
            cartItem.setQuantity(cartItem.getQuantity() + request.getQuantity());
            cartItemRepository.save(cartItem);
        } else {
            CartItem cartItem = CartItem.builder()
                    .cart(cart)
                    .foodItem(foodItem)
                    .quantity(request.getQuantity())
                    .build();
            cartItemRepository.save(cartItem);
        }

        return ResponseEntity.ok("Item added to cart");
    }

    @DeleteMapping("/cart/remove/{itemId}")
    public ResponseEntity<?> removeFromCart(@PathVariable("itemId") Long itemId, Principal principal) {
        User user = getAuthenticatedUser(principal);
        Cart cart = cartRepository.findByUser(user).orElseThrow();
        CartItem cartItem = cartItemRepository.findById(itemId).orElseThrow();
        if (cartItem.getCart().getId().equals(cart.getId())) {
            cartItemRepository.delete(cartItem);
        }
        return ResponseEntity.ok("Item removed from cart");
    }

    @DeleteMapping("/cart/clear")
    @Transactional
    public ResponseEntity<?> clearCart(Principal principal) {
        User user = getAuthenticatedUser(principal);
        Cart cart = cartRepository.findByUser(user).orElseThrow();
        cartItemRepository.deleteByCart(cart);
        return ResponseEntity.ok("Cart cleared");
    }

    @PostMapping("/checkout")
    @Transactional
    public ResponseEntity<?> checkout(@RequestBody CheckoutRequest request, Principal principal) {
        User user = getAuthenticatedUser(principal);
        Cart cart = cartRepository.findByUser(user).orElseThrow();
        List<CartItem> cartItems = cartItemRepository.findByCart(cart);

        if (cartItems.isEmpty()) {
            return ResponseEntity.badRequest().body("Cart is empty");
        }

        double subTotal = cartItems.stream().mapToDouble(i -> i.getFoodItem().getPrice() * i.getQuantity()).sum();
        double discount = 0.0;
        Coupon appliedCoupon = null;

        if (request.getCouponCode() != null && !request.getCouponCode().isBlank()) {
            Optional<Coupon> couponOpt = couponRepository.findByCodeIgnoreCase(request.getCouponCode());
            if (couponOpt.isPresent()) {
                Coupon coupon = couponOpt.get();
                if (coupon.isActive() && coupon.getExpiryDate().isAfter(LocalDateTime.now())) {
                    discount = subTotal * (coupon.getDiscountPercentage() / 100.0);
                    if (coupon.getMaxDiscount() != null && discount > coupon.getMaxDiscount()) {
                        discount = coupon.getMaxDiscount();
                    }
                    appliedCoupon = coupon;
                }
            }
        }

        double finalTotal = subTotal - discount;
        Restaurant restaurant = cartItems.get(0).getFoodItem().getRestaurant();

        // Place Order
        Order order = Order.builder()
                .customer(user)
                .restaurant(restaurant)
                .status(OrderStatus.CREATED)
                .totalAmount(finalTotal)
                .coupon(appliedCoupon)
                .deliveryAddress(request.getDeliveryAddress())
                .build();
        Order savedOrder = orderRepository.save(order);

        // Place Order Items
        for (CartItem item : cartItems) {
            OrderItem orderItem = OrderItem.builder()
                    .order(savedOrder)
                    .foodItem(item.getFoodItem())
                    .quantity(item.getQuantity())
                    .price(item.getFoodItem().getPrice())
                    .build();
            orderItemRepository.save(orderItem);
        }

        // Process Payment simulation
        PaymentMethod method = PaymentMethod.valueOf(request.getPaymentMethod().toUpperCase());
        PaymentStatus status = (method == PaymentMethod.COD) ? PaymentStatus.PENDING : PaymentStatus.COMPLETED;

        Payment payment = Payment.builder()
                .order(savedOrder)
                .paymentMethod(method)
                .status(status)
                .transactionId(UUID.randomUUID().toString())
                .build();
        paymentRepository.save(payment);

        // Clear Cart
        cartItemRepository.deleteByCart(cart);

        // Send notifications
        notificationRepository.save(Notification.builder()
                .user(user)
                .message("Order #" + savedOrder.getId() + " placed successfully! Total: ₹" + finalTotal)
                .build());

        notificationRepository.save(Notification.builder()
                .user(restaurant.getOwner())
                .message("New Order #" + savedOrder.getId() + " received from " + user.getUsername())
                .build());

        Map<String, Object> response = new HashMap<>();
        response.put("orderId", savedOrder.getId());
        response.put("total", finalTotal);
        response.put("status", savedOrder.getStatus());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/orders")
    public ResponseEntity<List<Order>> getOrderHistory(Principal principal) {
        User user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(orderRepository.findByCustomer(user));
    }

    @GetMapping("/orders/{orderId}")
    public ResponseEntity<?> getOrderDetails(@PathVariable("orderId") Long orderId, Principal principal) {
        User user = getAuthenticatedUser(principal);
        Order order = orderRepository.findById(orderId).orElseThrow();
        if (!order.getCustomer().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Access denied");
        }
        List<OrderItem> items = orderItemRepository.findByOrder(order);
        Map<String, Object> response = new HashMap<>();
        response.put("order", order);
        response.put("items", items);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/orders/{orderId}/rate")
    public ResponseEntity<?> rateOrder(@PathVariable("orderId") Long orderId, @RequestBody ReviewRequest request, Principal principal) {
        User user = getAuthenticatedUser(principal);
        Order order = orderRepository.findById(orderId).orElseThrow();
        if (!order.getCustomer().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Access denied");
        }
        if (order.getStatus() != OrderStatus.DELIVERED) {
            return ResponseEntity.badRequest().body("You can only review delivered orders");
        }

        Review review = Review.builder()
                .order(order)
                .customer(user)
                .rating(request.getRating())
                .comment(request.getComment())
                .build();
        reviewRepository.save(review);
        return ResponseEntity.ok("Review submitted successfully");
    }

    @GetMapping("/notifications")
    public ResponseEntity<List<Notification>> getNotifications(Principal principal) {
        User user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(notificationRepository.findByUserOrderByCreatedAtDesc(user));
    }
}
