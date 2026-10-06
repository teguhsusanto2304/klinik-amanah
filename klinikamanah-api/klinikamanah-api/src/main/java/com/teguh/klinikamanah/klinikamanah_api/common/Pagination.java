package com.teguh.klinikamanah.klinikamanah_api.common;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Paginated response in the shape of a Laravel resource collection: {data, links, meta}.
 */
public final class Pagination {

    private static final int ON_EACH_SIDE = 3;

    private Pagination() {
    }

    /**
     * Requested page number, 1 when missing or invalid.
     */
    public static int page(Map<String, String> query) {
        try {
            int page = Integer.parseInt(query.getOrDefault("page", "1").strip());
            return Math.max(page, 1);
        } catch (NumberFormatException e) {
            return 1;
        }
    }

    public static Map<String, Object> of(Page<?> page, List<?> data, int currentPage, Map<String, Object> extraMeta) {
        int perPage = page.getSize();
        long total = page.getTotalElements();
        int lastPage = Math.max((int) Math.ceil((double) total / perPage), 1);
        Long from = data.isEmpty() ? null : (long) (currentPage - 1) * perPage + 1;
        Long to = from == null ? null : from + data.size() - 1;
        String path = ServletUriComponentsBuilder.fromCurrentRequestUri().replaceQuery(null).build().toUriString();

        Map<String, Object> links = new LinkedHashMap<>();
        links.put("first", url(1));
        links.put("last", url(lastPage));
        links.put("prev", currentPage > 1 ? url(currentPage - 1) : null);
        links.put("next", currentPage < lastPage ? url(currentPage + 1) : null);

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("current_page", currentPage);
        meta.put("from", from);
        meta.put("last_page", lastPage);
        meta.put("links", pageLinks(currentPage, lastPage));
        meta.put("path", path);
        meta.put("per_page", perPage);
        meta.put("to", to);
        meta.put("total", total);
        meta.putAll(extraMeta);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("data", data);
        body.put("links", links);
        body.put("meta", meta);

        return body;
    }

    private static String url(int page) {
        UriComponentsBuilder builder = ServletUriComponentsBuilder.fromCurrentRequest();

        return builder.replaceQueryParam("page", page).build().toUriString();
    }

    /**
     * Page links with "..." separators, following Laravel's UrlWindow.
     */
    private static List<Map<String, Object>> pageLinks(int current, int last) {
        List<Map<String, Object>> links = new ArrayList<>();
        links.add(link(current > 1 ? url(current - 1) : null, "&laquo; Previous", current > 1 ? current - 1 : null, false));

        List<Integer> pages = new ArrayList<>();
        int window = ON_EACH_SIDE + 4;

        if (last < ON_EACH_SIDE * 2 + 8) {
            addRange(pages, 1, last);
        } else if (current <= window) {
            addRange(pages, 1, window + ON_EACH_SIDE);
            pages.add(null);
            addRange(pages, last - 1, last);
        } else if (current > last - window) {
            addRange(pages, 1, 2);
            pages.add(null);
            addRange(pages, last - (window + (ON_EACH_SIDE - 1)), last);
        } else {
            addRange(pages, 1, 2);
            pages.add(null);
            addRange(pages, current - ON_EACH_SIDE, current + ON_EACH_SIDE);
            pages.add(null);
            addRange(pages, last - 1, last);
        }

        for (Integer page : pages) {
            links.add(page == null ? link(null, "...", null, false) : link(url(page), String.valueOf(page), page, page == current));
        }

        links.add(link(current < last ? url(current + 1) : null, "Next &raquo;", current < last ? current + 1 : null, false));

        return links;
    }

    private static void addRange(List<Integer> pages, int from, int to) {
        for (int page = from; page <= to; page++) {
            pages.add(page);
        }
    }

    private static Map<String, Object> link(String url, String label, Integer page, boolean active) {
        Map<String, Object> link = new LinkedHashMap<>();
        link.put("url", url);
        link.put("label", label);
        link.put("page", page);
        link.put("active", active);

        return link;
    }
}
