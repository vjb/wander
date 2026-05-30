try:
    import playwright
    print('playwright:', playwright.__version__)
except ImportError as e:
    print('not found:', e)
