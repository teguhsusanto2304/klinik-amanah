package com.teguh.klinikamanah.klinikamanah_api.auth;

import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.servlet.HandlerInterceptor;

import com.teguh.klinikamanah.klinikamanah_api.common.ApiException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

/**
 * Requires a valid "Authorization: Bearer {token}" header and exposes the user to controllers as an
 * {@link AuthUser} argument.
 */
@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor, HandlerMethodArgumentResolver {

    private static final String ATTRIBUTE = AuthUser.class.getName();

    private final AuthService auth;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equals(request.getMethod())) {
            return true;
        }

        String header = request.getHeader("Authorization");
        String token = header != null && header.regionMatches(true, 0, "Bearer ", 0, 7) ? header.substring(7).strip() : null;
        AuthUser user = auth.authenticate(token);

        if (user == null) {
            throw ApiException.unauthenticated();
        }

        request.setAttribute(ATTRIBUTE, user);

        return true;
    }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return AuthUser.class.equals(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer, NativeWebRequest webRequest,
            WebDataBinderFactory binderFactory) {
        Object user = webRequest.getAttribute(ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);

        if (user == null) {
            throw ApiException.unauthenticated();
        }

        return user;
    }
}
