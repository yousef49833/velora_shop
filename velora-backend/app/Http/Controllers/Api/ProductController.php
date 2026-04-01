<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index()
    {
        return response()->json(Product::with('category', 'reviews.user')->paginate(12));
    }

    public function show(Product $product)
    {
        return response()->json($product->load('category', 'reviews.user'));
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'stock' => 'required|integer|min:0',
            'category_id' => 'nullable|exists:categories,id',
            'images' => 'nullable|array',
            'images.*' => 'string',
        ]);

        $product = Product::create($data);
        return response()->json($product, 201);
    }

    public function update(Request $request, Product $product)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'sometimes|nullable|string',
            'price' => 'sometimes|numeric|min:0',
            'stock' => 'sometimes|integer|min:0',
            'category_id' => 'sometimes|nullable|exists:categories,id',
            'images' => 'sometimes|nullable|array',
            'images.*' => 'string',
        ]);

        $product->update($data);

        return response()->json($product);
    }

    public function destroy(Request $request, Product $product)
    {
        $this->authorizeAdmin($request);
        $product->delete();

        return response()->json(['message' => 'Product removed']);
    }

    private function authorizeAdmin(Request $request)
    {
        $user = $this->authUser($request);
        if (! $user->isAdmin()) {
            abort(403, 'Admin access required');
        }

        return $user;
    }
}
