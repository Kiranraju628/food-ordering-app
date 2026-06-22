package com.foodapp.dto;

import lombok.Data;

@Data
public class CheckoutRequest {
    private String paymentMethod; // COD, CARD, UPI
    private String deliveryAddress; // Raw text or address string
    private String couponCode; // Optional
    private String upiId; // Optional, for UPI/Netbanking
}
