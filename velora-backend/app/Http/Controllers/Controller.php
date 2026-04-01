<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

abstract class Controller
{
    protected function authUser(Request $request): User
    {
        $header = $request->header('Authorization');
        if (! $header || ! str_starts_with($header, 'Bearer ')) {
            abort(401, 'Unauthorized');
        }

        $token = substr($header, 7);
        $user = User::where('api_token', $token)->first();

        if (! $user) {
            abort(401, 'Unauthorized');
        }

        $request->user = $user;

        return $user;
    }
}
