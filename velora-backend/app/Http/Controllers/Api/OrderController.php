<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        $user = $this->authUser($request);

        $data = $request->validate([
            'payment_method' => 'required|string',
            'shipping_address' => 'required|string',
        ]);

        $cartItems = CartItem::where('user_id', $user->id)->with('product')->get();
        if ($cartItems->isEmpty()) {
            return response()->json(['message' => 'Cart is empty'], 422);
        }

        $total = $cartItems->sum(fn ($item) => $item->product->price * $item->quantity);

        DB::beginTransaction();

        $order = Order::create([
            'user_id' => $user->id,
            'status' => 'pending',
            'total' => $total,
            'payment_method' => $data['payment_method'],
            'shipping_address' => $data['shipping_address'],
        ]);

        foreach ($cartItems as $cartItem) {
            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $cartItem->product->id,
                'quantity' => $cartItem->quantity,
                'price' => $cartItem->product->price,
            ]);

            $cartItem->delete();
            $cartItem->product->decrement('stock', $cartItem->quantity);
        }

        DB::commit();

        return response()->json($order->load('items.product'));
    }
}
