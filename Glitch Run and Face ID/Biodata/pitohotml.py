import pyhtml as h

t = h.html(
    h.head(
        h.title('My Page')
    ),
    h.body(
        h.h1('Welcome to My Page')
    )
)

print(t.render())