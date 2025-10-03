// internal/repository/mongodb.go
package repository

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"gitlab-list/internal/domain"
)

// MongoDBRepository implements caching using MongoDB
type MongoDBRepository struct {
	client     *mongo.Client
	database   *mongo.Database
	collection *mongo.Collection
}

// CachedProject represents a cached project with metadata
type CachedProject struct {
	ID          primitive.ObjectID `bson:"_id,omitempty"`
	Project     domain.Project     `bson:"project"`
	SearchHash  string             `bson:"search_hash"`
	ProjectHash string             `bson:"project_hash"` // Hash of project content for change detection
	CreatedAt   time.Time          `bson:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at"`
	Source      string             `bson:"source"` // "gitlab" or "cache"
}

// NewMongoDBRepository creates a new MongoDB repository
func NewMongoDBRepository(connectionString, databaseName string) (*MongoDBRepository, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(connectionString))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Test the connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	database := client.Database(databaseName)
	collection := database.Collection("projects")

	// Create indexes
	_, err = collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "search_hash", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "project_hash", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "created_at", Value: 1}},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create indexes: %w", err)
	}

	return &MongoDBRepository{
		client:     client,
		database:   database,
		collection: collection,
	}, nil
}

// CacheProjects caches a list of projects with search criteria
func (r *MongoDBRepository) CacheProjects(projects []domain.Project, searchHash string, projectHashes map[int]string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Remove existing cache for this search
	_, err := r.collection.DeleteMany(ctx, bson.M{"search_hash": searchHash})
	if err != nil {
		return fmt.Errorf("failed to clear existing cache: %w", err)
	}

	// Insert new cache entries
	var cacheEntries []interface{}
	now := time.Now()

	for _, project := range projects {
		projectHash := projectHashes[project.ID]
		cacheEntry := CachedProject{
			Project:     project,
			SearchHash:  searchHash,
			ProjectHash: projectHash,
			CreatedAt:   now,
			UpdatedAt:   now,
			Source:      "gitlab",
		}
		cacheEntries = append(cacheEntries, cacheEntry)
	}

	if len(cacheEntries) > 0 {
		_, err = r.collection.InsertMany(ctx, cacheEntries)
		if err != nil {
			return fmt.Errorf("failed to cache projects: %w", err)
		}
	}

	return nil
}

// GetCachedProjects retrieves cached projects by search hash
func (r *MongoDBRepository) GetCachedProjects(searchHash string) ([]domain.Project, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{
		"search_hash": searchHash,
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to find cached projects: %w", err)
	}
	defer cursor.Close(ctx)

	var cachedProjects []CachedProject
	if err = cursor.All(ctx, &cachedProjects); err != nil {
		return nil, fmt.Errorf("failed to decode cached projects: %w", err)
	}

	var projects []domain.Project
	for _, cached := range cachedProjects {
		projects = append(projects, cached.Project)
	}

	return projects, nil
}

// GetCachedProjectsWithHashes retrieves cached projects with their hashes
func (r *MongoDBRepository) GetCachedProjectsWithHashes(searchHash string) ([]CachedProject, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{
		"search_hash": searchHash,
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to find cached projects: %w", err)
	}
	defer cursor.Close(ctx)

	var cachedProjects []CachedProject
	if err = cursor.All(ctx, &cachedProjects); err != nil {
		return nil, fmt.Errorf("failed to decode cached projects: %w", err)
	}

	return cachedProjects, nil
}

// IsCacheValid checks if cache exists (no TTL, cache is always valid until manually cleared)
func (r *MongoDBRepository) IsCacheValid(searchHash string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{
		"search_hash": searchHash,
	}

	count, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return false, fmt.Errorf("failed to check cache validity: %w", err)
	}

	return count > 0, nil
}

// ClearAllCache removes all cache entries (no TTL-based expiration)
func (r *MongoDBRepository) ClearAllCache() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	_, err := r.collection.DeleteMany(ctx, bson.M{})
	if err != nil {
		return fmt.Errorf("failed to clear all cache: %w", err)
	}

	return nil
}

// GetCacheStats returns cache statistics
func (r *MongoDBRepository) GetCacheStats() (map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	stats := make(map[string]interface{})

	// Total cached projects
	totalCount, err := r.collection.CountDocuments(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("failed to count total cached projects: %w", err)
	}
	stats["total_cached_projects"] = totalCount

	// Cache entries by search hash
	pipeline := []bson.M{
		{
			"$group": bson.M{
				"_id":   "$search_hash",
				"count": bson.M{"$sum": 1},
			},
		},
	}

	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate cache stats: %w", err)
	}
	defer cursor.Close(ctx)

	var searchHashStats []bson.M
	if err = cursor.All(ctx, &searchHashStats); err != nil {
		return nil, fmt.Errorf("failed to decode search hash stats: %w", err)
	}

	stats["search_hashes"] = searchHashStats
	stats["cache_type"] = "hash_based" // Indicate this is hash-based cache

	return stats, nil
}

// Close closes the MongoDB connection
func (r *MongoDBRepository) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return r.client.Disconnect(ctx)
}
